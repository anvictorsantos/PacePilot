/** A model-proposed change to a day. The engine decides whether to take it. */
export interface PlanAiSuggestion {
  dayIndex: number
  suggestedType: string
  reason: string
}
