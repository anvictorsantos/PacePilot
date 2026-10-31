export interface Goal {
  goal_type?: string | null
  target_time_min?: number | null
  goal_date?: string | null
  days_per_week?: number | null
  preferred_days?: string[] | null
}
