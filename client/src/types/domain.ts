/**
 * Domain contracts, as the client reads them off the wire.
 *
 * These interfaces used to carry `[key: string]: unknown`, which made every
 * declared field advisory: an access to a field nobody had declared type-checked
 * as `unknown` and rendered `undefined` at runtime, and views worked around it by
 * holding untyped `ref(null)`. The escape hatch is gone — fields the UI reads are
 * declared, and the union types below are what the training vocabulary maps must
 * cover in full.
 *
 * Boundary note: fields the server owns and the client only forwards (chart
 * streams, arbitrary provider payloads) stay loosely typed on purpose. Everything
 * the client derives from is typed.
 */

/** Movement types the plan prescribes (CONTEXT.md §Workout), plus the two labels
 *  activity payloads can carry: `race` (a Strava classification) and `unknown`
 *  (Strava sent nothing we recognise). The vocabulary maps cover this whole set. */
export type WorkoutType =
  | 'rest'
  | 'recovery'
  | 'easy'
  | 'long'
  | 'steady'
  | 'tempo'
  | 'threshold'
  | 'interval'
  | 'intervals'
  | 'race'
  | 'unknown'

/** Goal targets the plan can be built toward (CONTEXT.md §Goal). */
export type GoalType =
  | 'general_fitness'
  | 'maintain'
  | 'distance_completion'
  | '5K'
  | '10K'
  | 'half_marathon'
  | 'marathon'

/** Outcome the athlete reports for a planned slot (CONTEXT.md §Feedback). */
export type FeedbackStatus = 'completed' | 'skipped'

export interface Trophy {
  segment?: string | null
  label?: string | null
  /** Seconds. */
  time?: number | null
  type?: string | null
}

export interface Lap {
  index?: number | null
  /** Metres, Strava convention. */
  distance?: number | null
  moving_time?: number | null
  elapsed_time?: number | null
  avg_heartrate?: number | null
  elev?: number | null
  elevation_gain?: number | null
  avg_pace_sec_km?: number | null
}

/** Strava streams, forwarded to the charts untouched. */
export interface ActivityStreams {
  time?: number[] | null
  distance?: number[] | null
  velocity_smooth?: number[] | null
  heartrate?: number[] | null
}

export interface Activity {
  id?: number | string | null
  _id?: number | string | null
  strava_activity_id?: number | string | null
  name?: string | null
  date?: string | null
  start_date?: string | null
  distance_m?: number | null
  distance_km?: number | null
  distance?: number | null
  moving_time?: number | null
  moving_time_min?: number | null
  moving_time_s?: number | null
  avg_pace_sec_km?: number | null
  average_speed?: number | null
  avg_hr?: number | null
  max_hr?: number | null
  elevation_m?: number | null
  avg_cadence?: number | null
  calories?: number | null
  workout_type?: string | null
  achievement_count?: number | null
  pr_count?: number | null
  trophies?: Trophy[] | null
  laps?: Lap[] | null
  streams?: ActivityStreams | null
  analysis?: string | null
}

export interface ActivitiesResponse {
  items?: Activity[] | null
  total?: number | null
}

/** User-reported outcome for a date (CONTEXT.md §Feedback). */
export interface PlanFeedback {
  date?: string | null
  status?: FeedbackStatus | string | null
  /** Perceived effort 1–10 (CONTEXT.md §RPE). */
  rpe?: number | null
  note?: string | null
  /** Server spelling of `note`. */
  notes?: string | null
}

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

export interface PlanDay {
  date?: string | null
  isToday?: boolean
  /** Deterministic programme role (phase / long-run target), computed server-side. */
  programmeRole?: string | null
  workout?: PlanWorkout | null
}

export interface PlanProgramme {
  phase?: string | null
  weeks_out?: number | null
  cutback?: boolean
  taper?: boolean
  long_run_km?: number | null
  long_run_target_km?: number | null
  notes?: string[]
}

export interface PlanWeekMeta {
  currentWeek?: number | null
  totalWeeks?: number | null
}

export interface PlanWeekResponse {
  week?: PlanDay[] | null
  weekMeta?: PlanWeekMeta | null
  goal?: Goal | null
  programme?: PlanProgramme | null
}

/** The single workout for today, adapted by the Feel Window (CONTEXT.md §Next Workout). */
export interface PlanRecommendation {
  type?: WorkoutType | string | null
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

export interface PlanTodayResponse {
  date?: string | null
  isRest?: boolean
  recommendation?: PlanRecommendation | null
  workout?: PlanWorkout | null
  /** Set when recent Feedback or Deviation changed the prescription. */
  adapted?: { reason?: string | null } | null
  training_state?: TrainingState | null
}

/** One day's AI-authored fields. Never carries schedule data. */
export interface PlanAiDay {
  date?: string | null
  aiExplanation?: string | null
  aiSuggestedType?: string | null
  aiSuggestionReason?: string | null
}

export interface PlanAiSuggestion {
  dayIndex: number
  suggestedType: string
  reason: string
}

export interface PlanAiWeekResponse {
  week?: PlanAiDay[] | null
  suggestions?: PlanAiSuggestion[] | null
  model?: string | null
  /** True when served from the server cache — no provider call was made. */
  cached?: boolean
  confidence?: number | null
  /** Human-readable reason AI is unavailable. Safe to display. */
  degraded?: string | null
  code?: string | null
}

export interface AiStatusResponse {
  enabled?: boolean
  configured?: boolean
  model?: string
  fallbackModel?: string | null
  modelStillFree?: boolean | null
  freeModels?: Array<{ id: string; supportsJsonMode: boolean }> | null
  catalogError?: string | null
}

/** Rolling 7/28-day windows derived from Strava activities (CONTEXT.md §TrainingState). */
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

export interface TrainingState {
  weekly?: TrainingWeekly | null
  trend?: string | null
  fatigueSignals?: string[] | null
}

/** Consistency over the last 28 days; `null` when there is too little history. */
export interface GoalProgress {
  pct?: number | null
  planned?: number | null
  completed?: number | null
}

export interface Goal {
  goal_type?: GoalType | string | null
  target_time_min?: number | null
  goal_date?: string | null
  days_per_week?: number | null
  preferred_days?: string[] | null
}

/** One bar of `volumeSeries` (CONTEXT.md §WeeklyProgression). */
export interface VolumePoint {
  label?: string | null
  distance?: number | null
}

export interface PacePoint {
  pace?: number | null
  hr?: number | null
}

/** A personal best surfaced on Progress (rename of the old `Record`, which
 *  shadowed TypeScript's own `Record` utility). */
export interface PersonalRecord {
  id?: number | string | null
  date?: string | null
  distance_km?: number | null
  pace?: number | null
}

export interface ProgressResponse {
  totalDistance?: number | null
  totalActivities?: number | null
  volumeSeries?: VolumePoint[] | null
  paceSeries?: PacePoint[] | null
  trainingState?: TrainingState | null
  goalProgress?: GoalProgress | null
  records?: PersonalRecord[] | null
}

export interface StravaStatus {
  connected?: boolean
  last_synced_at?: string | null
}

export interface SyncResult {
  last_synced_at?: string | null
  imported?: number | null
}

export interface CurrentUser {
  firstname?: string | null
  lastname?: string | null
  email?: string | null
  profile?: string | null
}

export interface CurrentUserResponse {
  user?: CurrentUser | null
}

/** Athlete-slot capacity (Strava quota). */
export interface WaitlistCapacity {
  limit?: number | null
  used?: number | null
  full?: boolean | null
}
