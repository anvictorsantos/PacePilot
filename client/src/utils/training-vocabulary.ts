/**
 * Presentation mapping for the training domain: the one module that turns a
 * plan's own words into UI copy.
 *
 * Goal labels, workout type names, badges, target pace/RPE, intensity tone and
 * pace strings used to be re-declared per surface — four goal-label maps, two
 * intensity-dot copies, four pace re-derivations, two near-identical badge sets
 * and a second avatar-colour table. This is the single declaration.
 *
 * The keys are the `WorkoutType` / `GoalType` enums from the domain modules, so
 * a new type cannot appear in one surface and be missing from another; every
 * user-visible string resolves through the i18n catalogue, so nothing here is
 * English-only.
 */
import { i18n } from '@/i18n'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import {
  goalCompletionLabelKey,
  goalLabelKey,
  goalPlanLabelKey,
} from '@/modules/goals/domain/value-object/GoalType.ts'
import {
  isEasyWorkout,
  toWorkoutType,
  WorkoutType,
} from '@/modules/training/domain/value-object/WorkoutType.ts'
import { formatPace } from '@/utils/format.ts'

function t(key: string): string {
  return i18n.global.t(key)
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
  [WorkoutType.Tempo]: 'ui.type_tempo',
  [WorkoutType.Interval]: 'ui.type_interval',
  [WorkoutType.Intervals]: 'ui.type_interval',
  [WorkoutType.Threshold]: 'ui.type_threshold',
  [WorkoutType.Steady]: 'ui.type_steady',
  [WorkoutType.Easy]: 'ui.type_easy',
  [WorkoutType.Recovery]: 'ui.type_recovery',
  [WorkoutType.Long]: 'ui.type_long',
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
  [WorkoutType.Rest]: 'ui.badge.rest',
  [WorkoutType.Recovery]: 'ui.badge.recovery',
  [WorkoutType.Easy]: 'ui.badge.easy',
  [WorkoutType.Long]: 'ui.badge.long',
  [WorkoutType.Steady]: 'ui.badge.steady',
  [WorkoutType.Tempo]: 'ui.badge.tempo',
  [WorkoutType.Threshold]: 'ui.badge.threshold',
  [WorkoutType.Interval]: 'ui.badge.interval',
  [WorkoutType.Intervals]: 'ui.badge.intervals',
  [WorkoutType.Race]: 'ui.badge.race',
  [WorkoutType.Unknown]: 'ui.badge.unknown',
}

export function workoutBadge(type: unknown): string {
  const known = toWorkoutType(type)
  return known ? t(WORKOUT_BADGES[known]) : String(type ?? '').toUpperCase()
}

/** Client-only display constants mirroring Figma 9:717 (CONTEXT.md §TARGET_MAP).
 *  Pace and RPE are numerals, so they stay literals rather than catalogue keys. */
export const WORKOUT_TARGETS: Record<WorkoutType, { pace: string; rpe: number | string }> = {
  [WorkoutType.Rest]: { pace: '—', rpe: '—' },
  [WorkoutType.Recovery]: { pace: '5:50/km', rpe: 4 },
  [WorkoutType.Easy]: { pace: '6:00/km', rpe: 3 },
  [WorkoutType.Long]: { pace: '5:40/km', rpe: 5 },
  [WorkoutType.Steady]: { pace: '5:25/km', rpe: 6 },
  [WorkoutType.Tempo]: { pace: '5:15/km', rpe: 7 },
  [WorkoutType.Threshold]: { pace: '5:00/km', rpe: 7 },
  [WorkoutType.Interval]: { pace: '4:55/km', rpe: 8 },
  [WorkoutType.Intervals]: { pace: '4:55/km', rpe: 8 },
  [WorkoutType.Race]: { pace: '—', rpe: '—' },
  [WorkoutType.Unknown]: { pace: '—', rpe: '—' },
}

export function workoutTarget(type: unknown): { pace: string; rpe: number | string } {
  const known = toWorkoutType(type)
  return (known && WORKOUT_TARGETS[known]) || WORKOUT_TARGETS[WorkoutType.Easy]
}

export const INTENSITY_LABELS: Partial<Record<WorkoutType, string>> = {
  [WorkoutType.Recovery]: 'ui.intensity_recovery',
  [WorkoutType.Easy]: 'ui.intensity_easy',
  [WorkoutType.Long]: 'ui.intensity_long',
  [WorkoutType.Steady]: 'ui.intensity_steady',
  [WorkoutType.Tempo]: 'ui.intensity_tempo',
  [WorkoutType.Threshold]: 'ui.intensity_threshold',
  [WorkoutType.Interval]: 'ui.intensity_interval',
  [WorkoutType.Intervals]: 'ui.intensity_interval',
}

export function intensityLabel(type: unknown): string | null {
  const known = toWorkoutType(type)
  const key = known ? INTENSITY_LABELS[known] : undefined
  return key ? t(key) : null
}

/** One tone per type; the three formatters below read it, so a new type cannot
 *  pick up a colour in one surface and not another. */
type Tone = 'danger' | 'primary' | 'warning' | 'success' | 'muted'

const INTENSITY_TONES: Record<WorkoutType, Tone> = {
  [WorkoutType.Rest]: 'muted',
  [WorkoutType.Recovery]: 'success',
  [WorkoutType.Easy]: 'success',
  [WorkoutType.Long]: 'success',
  [WorkoutType.Steady]: 'warning',
  [WorkoutType.Tempo]: 'primary',
  [WorkoutType.Threshold]: 'danger',
  [WorkoutType.Interval]: 'danger',
  [WorkoutType.Intervals]: 'danger',
  [WorkoutType.Race]: 'danger',
  [WorkoutType.Unknown]: 'muted',
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

/** Activity-detail label colour: the easy family reads cool, everything else warm. */
export function intensityTextClass(type: unknown): string {
  return isEasyWorkout(type) ? 'text-info' : 'text-primary'
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

/** Short goal name — "Half Marathon". */
export function goalLabel(goalType: unknown): string {
  return t(goalLabelKey(goalType))
}

/** Progress-card copy — "Half Marathon Completion". */
export function goalCompletionLabel(goalType: unknown): string {
  return t(goalCompletionLabelKey(goalType))
}

/** Training-plan header copy — "Half Marathon Training Plan". */
export function goalPlanLabel(goalType: unknown): string {
  return t(goalPlanLabelKey(goalType))
}
