/** Rolling 7/28-day windows derived from synced activities (CONTEXT.md §TrainingState). */
export interface TrainingWeekly {
  runs28?: number | null
  runs7?: number | null
  hardSessions14?: number | null
  hardSessions7?: number | null
  distance7?: number | null
  distance28?: number | null
  avgPace7?: number | null
  avgPace28?: number | null
  longRun7?: number | null
  longRun28?: number | null
}
