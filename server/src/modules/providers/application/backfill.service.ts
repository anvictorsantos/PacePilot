/**
 * Historical import — the athlete-triggered walk below the first-import cap.
 *
 * A step is bounded twice: `BACKFILL_PAGES_PER_STEP` provider pages per request
 * and `ACTIVITY_RETENTION_DAYS` of reach, because anything older than retention
 * is deleted by the Activity TTL and would be quota spent on rows nobody keeps.
 * All state lives in `BackfillCursor`, so stopping, a rate limit or a crashed
 * request resumes from the same cursor. Nothing here is on the read path for
 * Today or the plan: those answer from what is already stored.
 */
import mongoose from 'mongoose'

import {
  ACTIVITY_RETENTION_DAYS,
  Activity,
} from '@/modules/activities/infrastructure/persistence/Activity.ts'
import { persistActivities } from '@/modules/providers/application/activity-import.service.ts'
import {
  freshAccessToken,
  getConnection,
} from '@/modules/providers/application/connection.service.ts'
import { getProvider } from '@/modules/providers/application/provider-registry.ts'
import {
  BACKFILL_STALE_MS,
  advanceBackfill,
  beginBackfillStep,
  failBackfill,
  isBackfillRunnable,
  nextBackfillRequest,
  pauseBackfill,
  planBackfillStart,
  type BackfillState,
  type BackfillStatus,
} from '@/modules/providers/domain/backfill.ts'
import {
  ProviderAuthError,
  ProviderError,
  ProviderRateLimitError,
} from '@/modules/providers/domain/errors.ts'
import { BackfillCursor } from '@/modules/providers/infrastructure/persistence/BackfillCursor.ts'

/** What the client renders: the cursor is server truth, not a client loop. */
export interface BackfillProgress {
  status: BackfillStatus
  imported: number
  skipped: number
  pagesDone: number
  /** More of the retained window is still unfetched. */
  hasMore: boolean
  cursorBefore: string | null
  floor: string | null
  error: { code: string; retryAfter: number | null } | null
}

/** The persisted row, narrowed at this boundary — Mongo checks nothing. */
interface BackfillRow {
  _id: unknown
  status?: string | null
  cursor_before?: Date | null
  floor?: Date | null
  pages_done?: number | null
  imported?: number | null
  skipped?: number | null
  requested_at?: Date | null
  updated_at?: Date | null
  error?: { code?: string | null; at?: Date | null; retry_after?: number | null } | null
}

function isStatus(value: unknown): value is BackfillStatus {
  return (
    value === 'idle' ||
    value === 'pending' ||
    value === 'running' ||
    value === 'paused' ||
    value === 'complete' ||
    value === 'failed'
  )
}

function dateOf(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? null : date
}

function stateOf(row: BackfillRow | null): BackfillState {
  if (!row) {
    return {
      status: 'idle',
      cursorBefore: null,
      floor: null,
      pagesDone: 0,
      imported: 0,
      skipped: 0,
      requestedAt: null,
      updatedAt: null,
      error: null,
    }
  }
  return {
    status: isStatus(row.status) ? row.status : 'idle',
    cursorBefore: dateOf(row.cursor_before),
    floor: dateOf(row.floor),
    pagesDone: Number(row.pages_done ?? 0),
    imported: Number(row.imported ?? 0),
    skipped: Number(row.skipped ?? 0),
    requestedAt: dateOf(row.requested_at),
    updatedAt: dateOf(row.updated_at),
    error: row.error?.code
      ? {
          code: row.error.code,
          at: dateOf(row.error.at) ?? new Date(),
          retryAfter: row.error.retry_after ?? null,
        }
      : null,
  }
}

function fieldsOf(state: BackfillState): Record<string, unknown> {
  return {
    status: state.status,
    cursor_before: state.cursorBefore,
    floor: state.floor,
    pages_done: state.pagesDone,
    imported: state.imported,
    skipped: state.skipped,
    requested_at: state.requestedAt,
    updated_at: state.updatedAt,
    error: state.error
      ? { code: state.error.code, at: state.error.at, retry_after: state.error.retryAfter ?? null }
      : null,
  }
}

function progressOf(state: BackfillState): BackfillProgress {
  return {
    status: state.status,
    imported: state.imported,
    skipped: state.skipped,
    pagesDone: state.pagesDone,
    hasMore: nextBackfillRequest(state) !== null,
    cursorBefore: state.cursorBefore ? state.cursorBefore.toISOString() : null,
    floor: state.floor ? state.floor.toISOString() : null,
    error: state.error ? { code: state.error.code, retryAfter: state.error.retryAfter ?? null } : null,
  }
}

const IDLE: BackfillProgress = progressOf(stateOf(null))

function assertDatabase(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database not connected — check MONGODB_URI')
  }
}

/** Oldest activity we already hold — where the historical walk attaches. */
async function oldestActivityAt(athleteId: string): Promise<Date | null> {
  const oldest = await Activity.findOne({ athlete: athleteId })
    .sort({ date: 1 })
    .select('date')
    .lean()
  return dateOf((oldest as { date?: unknown } | null)?.date)
}

async function readRowState(athleteId: string, providerId: string): Promise<BackfillState> {
  const row = (await BackfillCursor.findOne({ athlete: athleteId, provider: providerId })
    .lean()) as unknown as BackfillRow | null
  return stateOf(row)
}

async function saveState(athleteId: string, providerId: string, state: BackfillState): Promise<void> {
  // Guarded on `running`: a manual sync may have paused the walk mid-page, and
  // its pause wins. The lost cursor update costs one idempotent re-fetch.
  await BackfillCursor.updateOne(
    { athlete: athleteId, provider: providerId, status: 'running' },
    { $set: fieldsOf(state) },
  )
}

/**
 * Queue a walk behind the first import. Called when a connection is created, so
 * a mid-season athlete has the retained window even before they ask for it; the
 * walk itself only runs when a step is requested.
 */
export async function queueBackfill(athleteId: string, providerId: string): Promise<void> {
  if (!mongoose.isValidObjectId(athleteId) || mongoose.connection.readyState !== 1) return
  const planned = planBackfillStart({
    now: new Date(),
    oldestActivityAt: await oldestActivityAt(athleteId),
    windowDays: ACTIVITY_RETENTION_DAYS,
  })
  try {
    await BackfillCursor.updateOne(
      { athlete: athleteId, provider: providerId },
      {
        $setOnInsert: {
          athlete: athleteId,
          provider: providerId,
          ...fieldsOf(planned),
        },
      },
      { upsert: true },
    )
  } catch (error) {
    // A concurrent connect already queued it; the unique key is the arbiter.
    if ((error as { code?: unknown })?.code !== 11000) throw error
  }
}

/** Current progress. No provider call, so the Settings card can read it freely. */
export async function readBackfill(athleteId: string, providerId: string): Promise<BackfillProgress> {
  if (!mongoose.isValidObjectId(athleteId)) return IDLE
  return progressOf(await readRowState(athleteId, providerId))
}

/**
 * Claim the cursor and run at most one bounded step. Returns the state even when
 * there was nothing to do (complete, or another step already holds the cursor),
 * so the caller never has to guess.
 */
export async function runBackfillStep({
  athleteId,
  providerId,
}: {
  athleteId: string
  providerId: string
}): Promise<BackfillProgress> {
  assertDatabase()
  if (!mongoose.isValidObjectId(athleteId)) {
    throw new ProviderAuthError(providerId, 'Not authenticated')
  }
  const provider = getProvider(providerId)
  if (!provider.capabilities.pull) return IDLE

  const connection = await getConnection(athleteId, providerId, { withCredentials: true })
  if (!connection?.access_token) {
    throw new ProviderAuthError(
      providerId,
      `No ${providerId} credentials found for this session — reconnect ${providerId}`,
    )
  }

  const claimed = await claimBackfill(athleteId, providerId)
  if (claimed.status !== 'running') return progressOf(claimed)

  const accessToken = await freshAccessToken(connection)
  let state = claimed
  try {
    for (;;) {
      const request = nextBackfillRequest(state)
      if (!request) break

      // The provider belongs to one caller at a time: a manual sync or the
      // athlete can take it between pages and the cursor waits for us.
      const live = (await BackfillCursor.findOne({ athlete: athleteId, provider: providerId })
        .select('status')
        .lean()) as unknown as { status?: string } | null
      if (live?.status !== 'running') break

      const batch = await provider.listActivities(accessToken, {
        before: request.before,
        perPage: request.perPage,
      })
      const items = batch.items
      const written = items.length
        ? await persistActivities(
            connection.athlete as mongoose.Types.ObjectId,
            providerId,
            items,
          )
        : { imported: 0, skipped: 0 }
      const oldest = items.reduce<Date | null>(
        (min, item) => (!min || item.startedAt < min ? item.startedAt : min),
        null,
      )

      state = advanceBackfill(
        {
          ...state,
          imported: state.imported + written.imported,
          skipped: state.skipped + written.skipped,
        },
        { fetched: items.length, oldest, exhausted: !batch.hasMore, now: new Date() },
      )
      await saveState(athleteId, providerId, state)
      if (state.status !== 'running') break
    }
  } catch (error) {
    const failed = failBackfill(state, {
      code: error instanceof ProviderError ? error.code : 'backfill_failed',
      retryAfter: error instanceof ProviderRateLimitError ? error.retryAfter : null,
      now: new Date(),
    })
    await saveState(athleteId, providerId, failed).catch(() => undefined)
    throw error
  }

  return progressOf(await readRowState(athleteId, providerId))
}

/** The athlete's stop. The cursor is untouched, so resume is the same request. */
export async function stopBackfill(
  athleteId: string,
  providerId: string,
): Promise<BackfillProgress> {
  assertDatabase()
  if (!mongoose.isValidObjectId(athleteId)) {
    throw new ProviderAuthError(providerId, 'Not authenticated')
  }
  const now = new Date()
  const state = await readRowState(athleteId, providerId)
  const paused = pauseBackfill(state, now)
  if (paused !== state) {
    await BackfillCursor.updateOne(
      { athlete: athleteId, provider: providerId },
      { $set: { status: paused.status, updated_at: paused.updatedAt } },
    )
  }
  return progressOf(paused)
}

/**
 * Plan on first use and take the cursor for this step. A `running` state held by
 * a live step is returned as-is — two callers never walk the same history.
 */
async function claimBackfill(athleteId: string, providerId: string): Promise<BackfillState> {
  const now = new Date()
  const row = (await BackfillCursor.findOne({ athlete: athleteId, provider: providerId }).lean()) as
    | unknown as BackfillRow
    | null

  let state = stateOf(row)
  if (!row || state.status === 'idle') {
    state = await storeState(
      athleteId,
      providerId,
      planBackfillStart({
        now,
        oldestActivityAt: await oldestActivityAt(athleteId),
        windowDays: ACTIVITY_RETENTION_DAYS,
      }),
    )
  } else if (state.status === 'pending' && state.pagesDone === 0) {
    // Queued on connect, before the first import wrote anything. Anchor the
    // cursor behind the oldest row we now hold so the walk never re-fetches a
    // range the first import already covered.
    const planned = planBackfillStart({
      now,
      oldestActivityAt: await oldestActivityAt(athleteId),
      windowDays: ACTIVITY_RETENTION_DAYS,
    })
    const cursorBefore =
      state.cursorBefore && planned.cursorBefore && state.cursorBefore < planned.cursorBefore
        ? state.cursorBefore
        : planned.cursorBefore
    state = await storeState(athleteId, providerId, {
      ...state,
      status: planned.status,
      floor: planned.floor,
      cursorBefore,
      requestedAt: state.requestedAt ?? now,
      updatedAt: now,
    })
  }

  if (!isBackfillRunnable(state, now)) return state

  const stale = new Date(now.getTime() - BACKFILL_STALE_MS)
  const claimed = (await BackfillCursor.findOneAndUpdate(
    state.status === 'running'
      ? { athlete: athleteId, provider: providerId, status: 'running', updated_at: { $lte: stale } }
      : { athlete: athleteId, provider: providerId, status: { $in: ['pending', 'paused', 'failed'] } },
    { $set: { status: 'running', error: null, updated_at: now } },
    { new: true },
  ).lean()) as unknown as BackfillRow | null

  // Lost the race: report the winner's state instead of starting a second walk.
  return claimed ? beginBackfillStep(stateOf(claimed), now) : await readRowState(athleteId, providerId)
}

/** Upsert the planned state and return it as the service sees it. */
async function storeState(
  athleteId: string,
  providerId: string,
  state: BackfillState,
): Promise<BackfillState> {
  try {
    const row = (await BackfillCursor.findOneAndUpdate(
      { athlete: athleteId, provider: providerId },
      { $set: { athlete: athleteId, provider: providerId, ...fieldsOf(state) } },
      { upsert: true, new: true },
    ).lean()) as unknown as BackfillRow
    return stateOf(row)
  } catch (error) {
    // Two first-time requests raced on the unique key: the row exists now, so
    // adopt it instead of failing the step.
    if ((error as { code?: unknown })?.code !== 11000) throw error
    await BackfillCursor.updateOne(
      { athlete: athleteId, provider: providerId },
      { $set: fieldsOf(state) },
    )
    return readRowState(athleteId, providerId)
  }
}
