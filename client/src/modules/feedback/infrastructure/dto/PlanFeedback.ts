// Must match `MAX_FEEDBACK_CHARS` in `ai/domain/coaching-contract.ts`: the server
// slices at that budget, so a larger form cap would be silently truncated.
export const FEEDBACK_NOTE_MAX_CHARS = 240

/** User-reported outcome for a date (CONTEXT.md §Feedback). */
export interface PlanFeedback {
  date?: string | null
  status?: string | null
  /** Perceived effort 1–10 (CONTEXT.md §RPE). */
  rpe?: number | null
  note?: string | null
  /** Server spelling of `note`. */
  notes?: string | null
}
