/** Consistency over the last 28 days; `null` when there is too little history. */
export interface GoalProgress {
  pct?: number | null
  planned?: number | null
  completed?: number | null
}
