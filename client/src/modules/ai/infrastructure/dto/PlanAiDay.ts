/** One day's AI-authored fields. Never carries schedule data. */
export interface PlanAiDay {
  date?: string | null
  aiExplanation?: string | null
  aiSuggestedType?: string | null
  aiSuggestionReason?: string | null
}
