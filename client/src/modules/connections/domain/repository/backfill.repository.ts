import type { BackfillStatus } from '@/modules/connections/domain/value-object/BackfillStatus.ts'

/** How far the historical import has walked; `imported` is cumulative and the
 *  server's cursor is the source of truth, so the client never sums its rounds. */
export interface BackfillProgress {
  status: BackfillStatus
  imported: number
  skipped: number
  pagesDone: number
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
