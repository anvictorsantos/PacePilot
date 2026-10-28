/**
 * Historical import — the athlete-triggered walk below the first-import cap.
 *
 * A step is bounded twice: `BACKFILL_PAGES_PER_STEP` provider pages per request
 * and `ACTIVITY_RETENTION_DAYS` of reach, because anything older than retention
 * is deleted by the Activity TTL and would be quota spent on rows nobody keeps.
 * All state lives in the cursor store, so stopping, a rate limit or a crashed
 * request resumes from the same cursor. Nothing here is on the read path for
 * Today or the plan: those answer from what is already stored.
 */
import mongoose from 'mongoose'

import { ACTIVITY_RETENTION_DAYS } from '@/modules/activities/infrastructure/persistence/Activity.ts'
import { persistActivities } from '@/modules/providers/application/activity-import.service.ts'
import {
  freshAccessToken,
  getConnection,
  type ConnectionLike,
} from '@/modules/providers/application/connection.service.ts'
import { getProvider } from '@/modules/providers/application/provider-registry.ts'
import {
  advanceBackfill,
  beginBackfillStep,
  emptyBackfill,
  failBackfill,
  isBackfillRunnable,
  nextBackfillRequest,
  planBackfillStart,
  type BackfillState,
  type BackfillStatus,
} from '@/modules/providers/domain/backfill.ts'
import {
  ProviderAuthError,
  ProviderError,
  ProviderRateLimitError,
} from '@/modules/providers/domain/errors.ts'
import type { ActivityProvider } from '@/modules/providers/domain/ports/ActivityProvider.ts'
import type { BackfillCursorRepository } from '@/modules/providers/domain/ports/BackfillCursorRepository.ts'
import type { CanonicalActivity } from '@/modules/providers/domain/CanonicalActivity.ts'
import { serviceUnavailable } from '@/modules/shared/infrastructure/errors/AppError.ts'
import { mongoBackfillCursor } from '@/modules/providers/infrastructure/persistence/BackfillCursor.ts'

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

/** Seams the use cases run against; tests drive them without Mongo or a provider. */
export interface BackfillDeps {
  store: BackfillCursorRepository
  provider(providerId: string): ActivityProvider
  connection(athleteId: string, providerId: string): Promise<ConnectionLike | null>
  /** A usable token, refreshed first when the stored one is about to expire. */
  accessToken(connection: ConnectionLike): Promise<string>
  persist(
    athleteId: string,
    providerId: string,
    items: CanonicalActivity[],
  ): Promise<{ imported: number; skipped: number }>
  /** Injected clock, so re-planning and claims are deterministic in tests. */
  now(): Date
  /** Whether MongoDB is up; a data route answers 503 rather than inventing state. */
  ready(): boolean
}

const defaultDeps: BackfillDeps = {
  store: mongoBackfillCursor,
  provider: getProvider,
  connection: (athleteId, providerId) =>
    getConnection(athleteId, providerId, { withCredentials: true }),
  accessToken: freshAccessToken,
  persist: (athleteId, providerId, items) =>
    persistActivities(new mongoose.Types.ObjectId(athleteId), providerId, items),
  now: () => new Date(),
  ready: () => mongoose.connection.readyState === 1,
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

const IDLE: BackfillProgress = progressOf(emptyBackfill())

function assertDatabase(deps: BackfillDeps): void {
  if (!deps.ready()) throw serviceUnavailable('Database not connected — check MONGODB_URI')
}

async function plannedState(
  athleteId: string,
  deps: BackfillDeps,
  now: Date,
): Promise<BackfillState> {
  return planBackfillStart({
    now,
    oldestActivityAt: await deps.store.oldestActivityAt(athleteId),
    windowDays: ACTIVITY_RETENTION_DAYS,
  })
}

/**
 * Queue a walk behind the first import. Called when a connection is created, so
 * a mid-season athlete has the retained window even before they ask for it; the
 * walk itself only runs when a step is requested.
 *
 * A re-link re-arms a cursor that can no longer reach history: a run that ended
 * `complete`/`failed`, or one whose floor predates the retention window. Without
 * this a long disconnect leaves the walk permanently finished with a stale floor
 * and no way to ask for the missing history.
 */
export async function queueBackfill(
  athleteId: string,
  providerId: string,
  deps: BackfillDeps = defaultDeps,
): Promise<void> {
  if (!mongoose.isValidObjectId(athleteId) || !deps.ready()) return
  const now = deps.now()
  const planned = await plannedState(athleteId, deps, now)
  const stored = await deps.store.load(athleteId, providerId)
  if (!stored) {
    await deps.store.create(athleteId, providerId, planned)
    return
  }
  if (!needsReplan(stored, planned)) return
  await deps.store.replaceUnlessRunning(athleteId, providerId, {
    ...planned,
    // The counters describe this athlete's history, not one particular run.
    imported: stored.imported,
    skipped: stored.skipped,
    requestedAt: stored.requestedAt ?? now,
  })
}

/** Whether the stored cursor is too old to reach the retained window. */
function needsReplan(stored: BackfillState, planned: BackfillState): boolean {
  if (stored.status === 'complete' || stored.status === 'failed') return true
  if (!stored.floor || !planned.floor) return true
  return stored.floor.getTime() < planned.floor.getTime()
}

/** Current progress. No provider call, so the Settings card can read it freely. */
export async function readBackfill(
  athleteId: string,
  providerId: string,
  deps: BackfillDeps = defaultDeps,
): Promise<BackfillProgress> {
  if (!mongoose.isValidObjectId(athleteId)) return IDLE
  return progressOf((await deps.store.load(athleteId, providerId)) ?? emptyBackfill())
}

/**
 * Claim the cursor and run at most one bounded step. A caller that cannot claim
 * — another step is live, the walk is complete, or the provider asked us to wait
 * — is answered with the stored progress rather than a second walk over the same
 * range. Two concurrent requests must never page the same history.
 */
export async function runBackfillStep(
  { athleteId, providerId }: { athleteId: string; providerId: string },
  deps: BackfillDeps = defaultDeps,
): Promise<BackfillProgress> {
  assertDatabase(deps)
  if (!mongoose.isValidObjectId(athleteId)) {
    throw new ProviderAuthError(providerId, 'Not authenticated')
  }
  const provider = deps.provider(providerId)
  if (!provider.capabilities.pull) return IDLE

  const connection = await deps.connection(athleteId, providerId)
  if (!connection?.access_token) {
    throw new ProviderAuthError(
      providerId,
      `No ${providerId} credentials found for this session — reconnect ${providerId}`,
    )
  }

  const claimed = await claimBackfill(athleteId, providerId, deps)
  if (!claimed) return readBackfill(athleteId, providerId, deps)

  const accessToken = await deps.accessToken(connection)
  let state = claimed
  try {
    for (;;) {
      const request = nextBackfillRequest(state)
      if (!request) break

      // The provider belongs to one caller at a time: a manual sync or the
      // athlete can take it between pages and the cursor waits for us.
      const live = await deps.store.load(athleteId, providerId)
      if (live?.status !== 'running') break

      const batch = await provider.listActivities(accessToken, {
        before: request.before,
        perPage: request.perPage,
      })
      const items = batch.items
      const written = items.length
        ? await deps.persist(athleteId, providerId, items)
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
        { fetched: items.length, oldest, exhausted: !batch.hasMore, now: deps.now() },
      )
      await deps.store.save(athleteId, providerId, state)
      if (state.status !== 'running') break
    }
  } catch (error) {
    const failed = failBackfill(state, {
      code: error instanceof ProviderError ? error.code : 'backfill_failed',
      retryAfter: error instanceof ProviderRateLimitError ? error.retryAfter : null,
      now: deps.now(),
    })
    await deps.store.save(athleteId, providerId, failed).catch(() => undefined)
    throw error
  }

  return readBackfill(athleteId, providerId, deps)
}

/**
 * The athlete's stop. The cursor is untouched, so resume is the same request.
 * Guarded on `running`: a step that finishes between the read and the write must
 * stay `complete`, otherwise history is stuck paused with no route back.
 */
export async function stopBackfill(
  athleteId: string,
  providerId: string,
  deps: BackfillDeps = defaultDeps,
): Promise<BackfillProgress> {
  assertDatabase(deps)
  if (!mongoose.isValidObjectId(athleteId)) {
    throw new ProviderAuthError(providerId, 'Not authenticated')
  }
  await deps.store.pauseRunning(athleteId, providerId, deps.now())
  return readBackfill(athleteId, providerId, deps)
}

/**
 * Plan on first use and take the cursor for this step. Returns null when the
 * cursor is not claimable: a live step holds it, the walk is complete, or the
 * provider's `retryAfter` has not elapsed. The caller reports stored progress
 * instead of walking.
 */
export async function claimBackfill(
  athleteId: string,
  providerId: string,
  deps: BackfillDeps = defaultDeps,
): Promise<BackfillState | null> {
  const now = deps.now()
  let state = await deps.store.load(athleteId, providerId)

  if (!state || state.status === 'idle') {
    const planned = await plannedState(athleteId, deps, now)
    if (state) await deps.store.replaceUnlessRunning(athleteId, providerId, planned)
    else await deps.store.create(athleteId, providerId, planned)
    // Adopt whatever the row holds now: a concurrent request may have queued or
    // claimed it between the load and the write.
    state = (await deps.store.load(athleteId, providerId)) ?? planned
  } else if (state.status === 'pending' && state.pagesDone === 0) {
    // Queued on connect, before the first import wrote anything. Anchor the
    // cursor behind the oldest row we now hold so the walk never re-fetches a
    // range the first import already covered. The write is guarded on `pending`,
    // so a step that claimed the cursor meanwhile keeps it.
    const planned = await plannedState(athleteId, deps, now)
    const cursorBefore =
      state.cursorBefore && planned.cursorBefore && state.cursorBefore < planned.cursorBefore
        ? state.cursorBefore
        : planned.cursorBefore
    const replanned: BackfillState = {
      ...state,
      status: planned.status,
      floor: planned.floor,
      cursorBefore,
      requestedAt: state.requestedAt ?? now,
      updatedAt: now,
    }
    const replaced = await deps.store.replacePendingPlan(athleteId, providerId, replanned)
    if (!replaced) return null
    state = replanned
  }

  if (!isBackfillRunnable(state, now)) return null

  const claimed = await deps.store.claim(athleteId, providerId, now)
  return claimed ? beginBackfillStep(claimed, now) : null
}
