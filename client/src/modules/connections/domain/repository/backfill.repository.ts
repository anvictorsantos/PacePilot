import type { BackfillStatus } from '@/modules/connections/domain/value-object/BackfillStatus.ts'

/**
 * How far the historical import has walked, in domain terms. `imported` is
 * cumulative for the walk — the server's cursor is the source of truth, so the
 * client never sums its own rounds.
 */
export interface BackfillProgress {
  status: BackfillStatus
  imported: number
  skipped: number
  pagesDone: number
  /** More of the retained window is still unfetched. */
  hasMore: boolean
  error: { code: string; retryAfter: number | null } | null
}

/** Port: the athlete-triggered walk below the first-import cap. */
export interface BackfillRepository {
  /** Current cursor state — no provider call. */
  status(): Promise<BackfillProgress>
  /** One bounded step. Repeats resume from the stored cursor. */
  step(): Promise<BackfillProgress>
  /** Pause. The cursor survives, so `step()` resumes it. */
  stop(): Promise<BackfillProgress>
}
