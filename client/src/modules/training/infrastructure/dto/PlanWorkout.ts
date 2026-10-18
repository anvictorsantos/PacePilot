/** One workout as the week payload carries it. The deterministic plan owns
 *  type/distance; the AI layer only explains and may suggest. */
export interface PlanWorkout {
  type?: string | null
  status?: string | null
  label?: string | null
  distance_km?: number | null
  distance?: number | null
  /** Why the engine adapted this slot (CONTEXT.md §Downgrade). */
  reason?: string | null
  aiExplanation?: string | null
  aiSuggestedType?: string | null
  aiSuggestionReason?: string | null
}
