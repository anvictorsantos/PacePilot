/**
 * Training vocabulary — the one module that turns a plan's own words into UI.
 *
 * Goal labels, workout type names, badges, target pace/RPE, intensity tone and
 * pace strings used to be re-declared per surface: four goal-label maps, two
 * intensity-dot copies, four pace re-derivations, two near-identical badge sets
 * and a second avatar-colour table. Each copy drifted on its own.
 *
 * This is the single declaration. The maps are keyed by the `WorkoutType` and
 * `GoalType` unions, so adding a type without naming it here is a compile error
 * rather than a blank label in production.
 */
import { i18n } from '@/i18n'
import type { Activity, GoalType, WorkoutType } from '@/types/domain.ts'
import { formatPace } from '@/utils/format.ts'

function t(key: string): string {
  return i18n.global.t(key)
}

const WORKOUT_TYPES: readonly WorkoutType[] = [
  'rest',
  'recovery',
  'easy',
  'long',
  'steady',
  'tempo',
  'threshold',
  'interval',
  'intervals',
  'race',
  'unknown',
]

/** Narrow a payload string to a known workout type. */
export function toWorkoutType(value: unknown): WorkoutType | null {
  const key = String(value ?? '').toLowerCase()
  return (WORKOUT_TYPES as readonly string[]).includes(key) ? (key as WorkoutType) : null
}

// ── Activity titles ────────────────────────────────────────────────────────

export const TITLE_MAP = {
  easy: 'ui.title_easy',
  tempo: 'ui.title_tempo',
  long: 'ui.title_long',
  threshold: 'ui.title_threshold',
  interval: 'ui.title_interval',
  recovery: 'ui.title_recovery',
  steady: 'ui.title_steady',
  unknown: 'ui.title_unknown',
}

/** The athlete's own name for a run when Strava gave one, else the type's title. */
export function activityTitle(a: Activity | null | undefined): string {
  if (a?.name && a.name !== 'Run') return a.name
  const key = TITLE_MAP[toWorkoutType(a?.workout_type) as keyof typeof TITLE_MAP]
  return t(key ?? TITLE_MAP.unknown)
}

// ── Workout type names ─────────────────────────────────────────────────────

/** i18n keys for the types with localized copy; `race`/`rest` read as themselves. */
export const WORKOUT_TYPE_NAMES: Partial<Record<WorkoutType, string>> = {
  tempo: 'ui.type_tempo',
  interval: 'ui.type_interval',
  intervals: 'ui.type_interval',
  threshold: 'ui.type_threshold',
  steady: 'ui.type_steady',
  easy: 'ui.type_easy',
  recovery: 'ui.type_recovery',
  long: 'ui.type_long',
}

export function workoutLabel(type: unknown): string {
  const known = toWorkoutType(type)
  const key = known ? WORKOUT_TYPE_NAMES[known] : undefined
  if (key) return t(key)
  return known ? known.toUpperCase() : String(type ?? '').toUpperCase()
}

// ── Badges, targets, tones ─────────────────────────────────────────────────

/** The compact uppercase badge on a schedule card (CONTEXT.md §TARGET_MAP/BADGE_MAP). */
export const WORKOUT_BADGES: Record<WorkoutType, string> = {
  rest: 'REST DAY',
  recovery: 'RECOVERY',
  easy: 'EASY RUN',
  long: 'LONG RUN',
  steady: 'STEADY RUN',
  tempo: 'TEMPO RUN',
  threshold: 'THRESHOLD',
  interval: 'INTERVALS',
  intervals: 'INTERVALS',
  race: 'RACE',
  unknown: 'RUN',
}

export function workoutBadge(type: unknown): string {
  const known = toWorkoutType(type)
  return known ? WORKOUT_BADGES[known] : String(type ?? '').toUpperCase()
}

/** Client-only display constants mirroring Figma 9:717 (CONTEXT.md §TARGET_MAP). */
export const WORKOUT_TARGETS: Record<WorkoutType, { pace: string; rpe: number | string }> = {
  rest: { pace: '—', rpe: '—' },
  recovery: { pace: '5:50/km', rpe: 4 },
  easy: { pace: '6:00/km', rpe: 3 },
  long: { pace: '5:40/km', rpe: 5 },
  steady: { pace: '5:25/km', rpe: 6 },
  tempo: { pace: '5:15/km', rpe: 7 },
  threshold: { pace: '5:00/km', rpe: 7 },
  interval: { pace: '4:55/km', rpe: 8 },
  intervals: { pace: '4:55/km', rpe: 8 },
  race: { pace: '—', rpe: '—' },
  unknown: { pace: '—', rpe: '—' },
}

export function workoutTarget(type: unknown): { pace: string; rpe: number | string } {
  const known = toWorkoutType(type)
  return (known && WORKOUT_TARGETS[known]) || WORKOUT_TARGETS.easy
}

export const INTENSITY_LABELS: Partial<Record<WorkoutType, string>> = {
  recovery: 'ui.intensity_recovery',
  easy: 'ui.intensity_easy',
  long: 'ui.intensity_long',
  steady: 'ui.intensity_steady',
  tempo: 'ui.intensity_tempo',
  threshold: 'ui.intensity_threshold',
  interval: 'ui.intensity_interval',
  intervals: 'ui.intensity_interval',
}

export function intensityLabel(type: unknown): string | null {
  const known = toWorkoutType(type)
  const key = known ? INTENSITY_LABELS[known] : undefined
  return key ? t(key) : null
}

/** One tone per type; the three formatters below read it, so a new type cannot
 *  pick up a colour by accident in one surface and not another. */
type Tone = 'danger' | 'primary' | 'warning' | 'success' | 'muted'

const INTENSITY_TONES: Record<WorkoutType, Tone> = {
  rest: 'muted',
  recovery: 'success',
  easy: 'success',
  long: 'success',
  steady: 'warning',
  tempo: 'primary',
  threshold: 'danger',
  interval: 'danger',
  intervals: 'danger',
  race: 'danger',
  unknown: 'muted',
}

const TONE_DOT: Record<Tone, string> = {
  danger: 'bg-danger',
  primary: 'bg-primary',
  warning: 'bg-warning',
  success: 'bg-success',
  muted: 'bg-muted',
}

const TONE_AVATAR: Record<Tone, string> = {
  danger: 'bg-primary',
  primary: 'bg-primary',
  warning: 'bg-warning',
  success: 'bg-success',
  muted: 'bg-muted',
}

function tone(type: unknown): Tone {
  const known = toWorkoutType(type)
  return known ? INTENSITY_TONES[known] : 'muted'
}

/** Intensity dot beside a workout label. */
export function intensityDotClass(type: unknown): string {
  return TONE_DOT[tone(type)]
}

const EASY_FAMILY: readonly WorkoutType[] = ['easy', 'recovery', 'long']

/** Activity-detail label colour: the easy family reads cool, everything else warm. */
export function intensityTextClass(type: unknown): string {
  const known = toWorkoutType(type)
  return known && EASY_FAMILY.includes(known) ? 'text-info' : 'text-primary'
}

/** Avatar chip in the notification list — one colour per intensity family. */
export function intensityAvatarClass(type: unknown): string {
  return TONE_AVATAR[tone(type)]
}

// ── Pace ───────────────────────────────────────────────────────────────────

/** `m:ss /km` from seconds per kilometre. */
export function paceFromSec(sec: number | null | undefined): string {
  return formatPace(sec ?? null)
}

/** `m:ss /km` from an activity, whichever pace field the server sent. */
export function paceFromActivity(a: Activity | null | undefined): string {
  if (a?.avg_pace_sec_km) return formatPace(a.avg_pace_sec_km)
  // Strava reports speed in m/s when it has no pace
  if (a?.average_speed) return formatPace(1000 / a.average_speed)
  return '—'
}

// ── Goals ──────────────────────────────────────────────────────────────────

/** Short goal names, as the athlete sees them in the plan and the goal form. */
export const GOAL_LABELS: Record<GoalType, string> = {
  general_fitness: 'General Fitness',
  maintain: 'Maintain Fitness',
  distance_completion: 'Distance Completion',
  '5K': '5K',
  '10K': '10K',
  half_marathon: 'Half Marathon',
  marathon: 'Marathon',
}

const GOAL_KEYS = Object.keys(GOAL_LABELS) as readonly string[]

export function toGoalType(value: unknown): GoalType | null {
  const key = String(value ?? '')
  return GOAL_KEYS.includes(key) ? (key as GoalType) : null
}

export function goalLabel(goalType: unknown): string {
  const known = toGoalType(goalType)
  if (known) return GOAL_LABELS[known]
  const raw = String(goalType ?? '').trim()
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Goal copy for the progress card ("Half Marathon Completion"). */
export function goalCompletionLabel(goalType: unknown): string {
  const label = goalLabel(goalType)
  return label === '—' ? '—' : `${label} Completion`
}

/** Goal copy for the training-plan header ("Half Marathon Training Plan"). */
const GOAL_PLAN_KEYS: Record<GoalType, string> = {
  general_fitness: 'ui.goal_label.general_fitness',
  maintain: 'ui.goal_label.maintain',
  distance_completion: 'ui.goal_label.distance_completion',
  '5K': 'ui.goal_label.5k',
  '10K': 'ui.goal_label.10k',
  half_marathon: 'ui.goal_label.half_marathon',
  marathon: 'ui.goal_label.marathon',
}

export function goalPlanLabel(goalType: unknown): string {
  const known = toGoalType(goalType)
  return known ? t(GOAL_PLAN_KEYS[known]) : t('ui.goal_label.fallback')
}

/** Options for the goal form's target select, in display order. */
export const GOAL_OPTIONS: Array<{ value: GoalType; label: string }> = [
  { value: 'general_fitness', label: GOAL_LABELS.general_fitness },
  { value: '5K', label: GOAL_LABELS['5K'] },
  { value: '10K', label: GOAL_LABELS['10K'] },
  { value: 'half_marathon', label: GOAL_LABELS.half_marathon },
  { value: 'marathon', label: GOAL_LABELS.marathon },
  { value: 'distance_completion', label: GOAL_LABELS.distance_completion },
  { value: 'maintain', label: GOAL_LABELS.maintain },
]
