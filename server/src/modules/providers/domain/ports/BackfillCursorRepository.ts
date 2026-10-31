import type { BackfillState } from '@/modules/providers/domain/backfill.ts'
import type { BackfillPausePort } from '@/modules/providers/domain/ports/BackfillPause.ts'

// `claim` and both `replace` methods are compare-and-set on the stored status: a
// caller that loses the race reports the winner's state instead of walking the same range.
export interface BackfillCursorRepository extends BackfillPausePort {
  /** The stored state, or null when this athlete never queued a walk. */
  load(athleteId: string, provider: string): Promise<BackfillState | null>
  /** Create the queued plan; an existing row is left untouched. */
  create(athleteId: string, provider: string, state: BackfillState): Promise<void>
  /** Replace a queued plan no step has touched yet. False when a step got there first. */
  replacePendingPlan(
    athleteId: string,
    provider: string,
    state: BackfillState,
  ): Promise<boolean>
  /** Replace a stored state unless a step is walking it right now. */
  replaceUnlessRunning(
    athleteId: string,
    provider: string,
    state: BackfillState,
  ): Promise<boolean>
  /** Take the cursor for one step; null when a live step already holds it. */
  claim(athleteId: string, provider: string, now: Date): Promise<BackfillState | null>
  /** Save progress while this step still holds the claim; a pause wins. */
  save(athleteId: string, provider: string, state: BackfillState): Promise<void>
  /** Oldest activity already stored — where the walk attaches. */
  oldestActivityAt(athleteId: string): Promise<Date | null>
}
