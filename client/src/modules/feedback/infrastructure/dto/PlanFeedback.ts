/**
 * The note is the only free-text field the athlete writes that reaches both the
 * AI prompt and storage. The server caps it at the prompt's own budget
 * (`MAX_FEEDBACK_CHARS = 240` in `ai/domain/coaching-contract.ts`); the form uses
 * the same number so nothing is accepted here and silently sliced there.
 */
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
