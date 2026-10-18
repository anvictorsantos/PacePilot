/** The single workout for today, adapted by the Feel Window (CONTEXT.md §Next Workout). */
export interface PlanRecommendation {
  type?: string | null
  distance_km?: number | null
  duration_min?: number | null
  intensity?: string | null
  target_pace?: string | null
  /** Why this workout, in the athlete's language (display-only). */
  purpose?: string | null
  main_set?: string | null
  warmup?: string | null
  cooldown?: string | null
  alternative?: string | null
}
