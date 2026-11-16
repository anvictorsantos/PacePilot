/** The single workout for today, adapted by the Feel Window (CONTEXT.md §Next Workout). */
export interface PlanRecommendation {
  type?: string | null
  distance_km?: number | null
  duration_min?: number | null
  intensity?: string | null
  target_pace?: string | null
  /** The athlete's own easy band (28-day average ±5/+15 s), the pace warm-up and cool-down are split at. */
  easy_pace?: string | null
  /** Why this workout, in the athlete's language (display-only). */
  purpose?: string | null
  main_set?: string | null
  warmup?: string | null
  cooldown?: string | null
  /** Engine-derived distances: the minute prescription at the athlete's easy pace. */
  warmup_km?: number | null
  main_km?: number | null
  cooldown_km?: number | null
  alternative?: string | null
}
