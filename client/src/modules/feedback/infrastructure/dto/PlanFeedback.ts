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
