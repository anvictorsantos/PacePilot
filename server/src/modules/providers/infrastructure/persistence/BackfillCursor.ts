import mongoose from 'mongoose'

import { Activity } from '@/modules/activities/infrastructure/persistence/Activity.ts'
import {
  BACKFILL_STALE_MS,
  BACKFILL_STATUSES,
  type BackfillState,
  type BackfillStatus,
} from '@/modules/providers/domain/backfill.ts'
import type { BackfillCursorRepository } from '@/modules/providers/domain/ports/BackfillCursorRepository.ts'

const errorSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    at: { type: Date, required: true },
    /** Seconds the provider asked us to wait, when it said so. */
    retry_after: { type: Number, default: null },
  },
  { _id: false },
)

/**
 * The historical-import cursor, one row per `{athlete, provider}`. It lives in
 * its own collection rather than on `Connection` because that row is the
 * credential and capacity record, and because a legacy connection (credentials
 * still on `Athlete`) has no `_id` to hang state on.
 *
 * `cursor_before` is the whole resumable state: everything older than it is
 * still to fetch. `updated_at` is the claim clock (a step that stops heartbeating
 * frees the cursor), and `status` is the domain's `BackfillStatus`.
 */
const backfillSchema = new mongoose.Schema(
  {
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', required: true },
    provider: { type: String, required: true },
    status: { type: String, enum: [...BACKFILL_STATUSES], default: 'idle' },
    cursor_before: Date,
    floor: Date,
    pages_done: { type: Number, default: 0 },
    imported: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    requested_at: Date,
    updated_at: Date,
    completed_at: Date,
    error: { type: errorSchema, default: null },
  },
  { timestamps: true },
)

backfillSchema.index({ athlete: 1, provider: 1 }, { unique: true })

export const BackfillCursor = mongoose.model('BackfillCursor', backfillSchema)

/** The persisted row, narrowed at this boundary — Mongo checks nothing. */
interface BackfillRow {
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
  return BACKFILL_STATUSES.includes(value as BackfillStatus)
}

function dateOf(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? null : date
}

function stateOf(row: BackfillRow): BackfillState {
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

/**
 * Mongo adapter for the cursor. Every write is guarded on the stored status so
 * two processes can race a claim without both walking the range: only one
 * `claim` matches, and a pause recorded while a step runs is never overwritten
 * by that step's progress.
 */
export const mongoBackfillCursor: BackfillCursorRepository = {
  async load(athleteId, provider) {
    const row = (await BackfillCursor.findOne({ athlete: athleteId, provider }).lean()) as
      | BackfillRow
      | null
    return row ? stateOf(row) : null
  },

  async create(athleteId, provider, state) {
    try {
      await BackfillCursor.updateOne(
        { athlete: athleteId, provider },
        { $setOnInsert: { athlete: athleteId, provider, ...fieldsOf(state) } },
        { upsert: true },
      )
    } catch (error) {
      // A concurrent connect already queued it; the unique key is the arbiter.
      if ((error as { code?: unknown })?.code !== 11000) throw error
    }
  },

  async replacePendingPlan(athleteId, provider, state) {
    const result = await BackfillCursor.updateOne(
      { athlete: athleteId, provider, status: 'pending' },
      { $set: fieldsOf(state) },
    )
    return result.matchedCount > 0
  },

  async replaceUnlessRunning(athleteId, provider, state) {
    const result = await BackfillCursor.updateOne(
      { athlete: athleteId, provider, status: { $ne: 'running' } },
      { $set: fieldsOf(state) },
    )
    return result.matchedCount > 0
  },

  async claim(athleteId, provider, now) {
    const stale = new Date(now.getTime() - BACKFILL_STALE_MS)
    const row = (await BackfillCursor.findOneAndUpdate(
      {
        athlete: athleteId,
        provider,
        $or: [
          // A step whose owner died must not wedge the cursor forever.
          { status: 'running', updated_at: { $lte: stale } },
          { status: { $in: ['pending', 'paused', 'failed'] } },
        ],
      },
      { $set: { status: 'running', error: null, updated_at: now } },
      { new: true },
    ).lean()) as BackfillRow | null
    return row ? stateOf(row) : null
  },

  async save(athleteId, provider, state) {
    await BackfillCursor.updateOne(
      { athlete: athleteId, provider, status: 'running' },
      { $set: fieldsOf(state) },
    )
  },

  /**
   * A manual pull takes the provider for itself. Atomic on the stored status, so
   * a step that already finished is left alone.
   */
  async pauseRunning(athleteId, provider, at) {
    if (!mongoose.isValidObjectId(athleteId)) return
    await BackfillCursor.updateOne(
      { athlete: athleteId, provider, status: 'running' },
      { $set: { status: 'paused', updated_at: at } },
    )
  },

  async oldestActivityAt(athleteId) {
    const oldest = await Activity.findOne({ athlete: athleteId })
      .sort({ date: 1 })
      .select('date')
      .lean()
    return dateOf((oldest as { date?: unknown } | null)?.date)
  },
}
