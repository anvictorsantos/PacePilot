import mongoose from 'mongoose'

import { BACKFILL_STATUSES } from '@/modules/providers/domain/backfill.ts'

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

/**
 * A manual pull takes the provider for itself. Atomic on the stored status, so
 * a step that already finished is left alone — the walk resumes from its cursor
 * on the next request instead of competing page by page.
 */
export async function pauseRunningBackfill(
  athleteId: string,
  provider: string,
  now: Date = new Date(),
): Promise<void> {
  if (!mongoose.isValidObjectId(athleteId)) return
  await BackfillCursor.updateOne(
    { athlete: athleteId, provider, status: 'running' },
    { $set: { status: 'paused', updated_at: now } },
  )
}
