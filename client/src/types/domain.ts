export interface Activity {
  [key: string]: unknown
  id?: number | string | null
  strava_activity_id?: number | string | null
  date?: string | null
  start_date?: string | null
  distance_m?: number | null
  distance_km?: number | null
  moving_time?: number | null
  moving_time_min?: number | null
  moving_time_s?: number | null
  avg_pace_sec_km?: number | null
}

export interface ActivitiesResponse {
  [key: string]: unknown
  items?: Activity[] | null
  total?: number | null
}

export interface PlanFeedback {
  [key: string]: unknown
  date?: string | null
  status?: string | null
  rpe?: number | null
  note?: string | null
  notes?: string | null
}

export interface PlanWeekMeta {
  [key: string]: unknown
  currentWeek?: number | null
  totalWeeks?: number | null
}

export interface PlanDay {
  [key: string]: unknown
  date?: string | null
  workout?: {
    [key: string]: unknown
    type?: string | null
    status?: string | null
    label?: string | null
    distance?: unknown
  } | null
}

export interface PlanWeekResponse {
  [key: string]: unknown
  week?: PlanDay[] | null
  weekMeta?: PlanWeekMeta | null
  goal?: Goal | null
}

export interface PlanTodayResponse {
  [key: string]: unknown
}

export interface TrainingState {
  [key: string]: unknown
  weekly?: {
    [key: string]: unknown
    runs28?: number | null
    runs7?: number | null
    hardSessions14?: number | null
    hardSessions7?: number | null
    distance7?: number | null
    distance28?: number | null
    avgPace28?: number | null
    avgPace7?: number | null
    longRun28?: number | null
    longRun7?: number | null
  } | null
}

export interface GoalProgress {
  [key: string]: unknown
  pct?: number | null
  planned?: number | null
  completed?: number | null
}

export interface Goal {
  [key: string]: unknown
  goal_type?: string | null
  target_time_min?: number | null
  goal_date?: string | null
  days_per_week?: number | null
  preferred_days?: string[] | null
}

export interface Record {
  [key: string]: unknown
  id?: number | string | null
  date?: string | null
  distance_km?: number | null
  pace?: number | null
}

export interface ProgressResponse {
  [key: string]: unknown
  totalDistance?: number | null
  totalActivities?: number | null
  volumeSeries?: unknown[] | null
  trainingState?: TrainingState | null
  goalProgress?: GoalProgress | null
  records?: Record[] | null
}

export interface StravaStatus {
  [key: string]: unknown
  connected?: boolean
  last_synced_at?: string | null
}

export interface CurrentUser {
  [key: string]: unknown
  firstname?: string | null
  lastname?: string | null
  email?: string | null
  profile?: string | null
}

export interface Row {
  [key: string]: unknown
}
