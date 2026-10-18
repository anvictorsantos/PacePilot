/**
 * Outcome the athlete reports for a planned slot (CONTEXT.md §Feedback).
 * `Skipped` is the value that changes the plan: the engine eases the remaining
 * preferred slots to recovery.
 */
export enum FeedbackStatus {
  Completed = 'completed',
  Skipped = 'skipped',
}

export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = Object.values(FeedbackStatus)

export function toFeedbackStatus(value: unknown): FeedbackStatus | null {
  const key = String(value ?? '')
  return (FEEDBACK_STATUSES as readonly string[]).includes(key) ? (key as FeedbackStatus) : null
}

/** Anything that is not an explicit skip counts as completed (CONTEXT.md §Implicit Skip). */
export function isCompletedStatus(value: unknown): boolean {
  return toFeedbackStatus(value) !== FeedbackStatus.Skipped
}
