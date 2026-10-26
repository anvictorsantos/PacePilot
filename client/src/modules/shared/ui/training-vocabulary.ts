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
import {
  ActivityKind,
  toActivityKind,
} from '@/modules/activities/domain/value-object/ActivityKind.ts'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import {
  goalCompletionLabelKey,
  goalLabelKey,
  goalPlanLabelKey,
} from '@/modules/goals/domain/value-object/GoalType.ts'
import { formatPace } from '@/modules/shared/ui/format.ts'
import {
  isEasyWorkout,
  toWorkoutType,
  WorkoutType,
} from '@/modules/training/domain/value-object/WorkoutType.ts'

function t(key: string, params?: Record<string, unknown>): string {
  return params ? i18n.global.t(key, params) : i18n.global.t(key)
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
  other: 'ui.title_other',
  unknown: 'ui.title_unknown',
}

/** Cross-training has no workout_type, so its title comes from the family. */
const KIND_TITLES: Partial<Record<ActivityKind, string>> = {
  [ActivityKind.Hiit]: 'ui.title_hiit',
  [ActivityKind.Strength]: 'ui.title_strength',
  [ActivityKind.Ride]: 'ui.title_ride',
  [ActivityKind.Swim]: 'ui.title_swim',
  [ActivityKind.Mobility]: 'ui.title_mobility',
  [ActivityKind.Other]: 'ui.title_other',
}

/** The athlete's own name for a run when Strava gave one, else the type's title. */
export function activityTitle(a: Activity | null | undefined): string {
  if (a?.name && a.name !== 'Run') return a.name
  const kind = toActivityKind(a?.kind)
  const kindKey = kind && kind !== ActivityKind.Run ? KIND_TITLES[kind] : undefined
  if (kindKey) return t(kindKey)
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

/** Resolve the server's programme-role key + params into a localized label.
 *  Phase slugs resolve first, so the label reads "Base · long run · target 21km"
 *  in either language; the separator is the only thing concatenated here. */
export function programmeRoleLabel(role: unknown, params?: Record<string, unknown> | null): string {
  // Only the key form is renderable. An older server payload carried an English
  // sentence here; showing "ui.quality session" would be worse than showing
  // nothing, so the label is omitted until both sides match.
  if (typeof role !== 'string' || !role.startsWith('role_')) return ''
  const parts: string[] = []
  const phase = params?.phase
  if (typeof phase === 'string' && phase) parts.push(t(`ui.phase_${phase}`))
  parts.push(t(`ui.${role}`))
  const target = params?.target
  if (typeof target === 'string' && target) parts.push(t('ui.target_suffix', { target }))
  return parts.filter(Boolean).join(' · ')
}

export function workoutLabelKey(type: unknown): string | null {
  const known = toWorkoutType(type)
  return (known ? WORKOUT_TYPE_NAMES[known] : undefined) ?? null
}

export function workoutLabel(type: unknown): string {
  const known = toWorkoutType(type)
  const key = workoutLabelKey(type)
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
  [WorkoutType.Other]: 'ui.badge.other',
  [WorkoutType.Unknown]: 'ui.badge.unknown',
}

export function workoutBadgeKey(type: unknown): string | null {
  const known = toWorkoutType(type)
  return known ? WORKOUT_BADGES[known] : null
}

export function workoutBadge(type: unknown): string {
  const key = workoutBadgeKey(type)
  return key ? t(key) : String(type ?? '').toUpperCase()
}

/** One-line purpose for a session, used where the plan is previewed rather than
 *  opened. Deliberately short: it sits under a badge in a three-card row. */
export const WORKOUT_PURPOSES: Partial<Record<WorkoutType, string>> = {
  [WorkoutType.Recovery]: 'ui.purpose_recovery',
  [WorkoutType.Easy]: 'ui.purpose_easy',
  [WorkoutType.Long]: 'ui.purpose_long',
  [WorkoutType.Steady]: 'ui.purpose_steady',
  [WorkoutType.Tempo]: 'ui.purpose_tempo',
  [WorkoutType.Threshold]: 'ui.purpose_threshold',
  [WorkoutType.Interval]: 'ui.purpose_interval',
  [WorkoutType.Intervals]: 'ui.purpose_interval',
  [WorkoutType.Race]: 'ui.purpose_race',
}

export function workoutPurposeKey(type: unknown): string | null {
  const known = toWorkoutType(type)
  return (known ? WORKOUT_PURPOSES[known] : undefined) ?? null
}

/** The sessions the programme treats as quality work — the ones a preview
 *  surfaces after the long run. */
const QUALITY_TYPES = new Set<WorkoutType>([
  WorkoutType.Tempo,
  WorkoutType.Threshold,
  WorkoutType.Interval,
  WorkoutType.Intervals,
])

export function isQualityWorkout(type: unknown): boolean {
  const known = toWorkoutType(type)
  return known ? QUALITY_TYPES.has(known) : false
}

/** Cross-training badge, keyed by family (the workout_type is always `other`). */
const KIND_BADGES: Partial<Record<ActivityKind, string>> = {
  [ActivityKind.Hiit]: 'ui.badge.hiit',
  [ActivityKind.Strength]: 'ui.badge.strength',
  [ActivityKind.Ride]: 'ui.badge.ride',
  [ActivityKind.Swim]: 'ui.badge.swim',
  [ActivityKind.Mobility]: 'ui.badge.mobility',
  [ActivityKind.Other]: 'ui.badge.other',
}

/**
 * The badge for an activity row: runs keep their workout type, cross-training
 * reads its family so HIIT does not render as a generic "CROSS-TRAIN".
 */
export function activityBadge(a: Activity | null | undefined): string {
  const kind = toActivityKind(a?.kind)
  if (kind && kind !== ActivityKind.Run) {
    const key = KIND_BADGES[kind]
    if (key) return t(key)
  }
  return workoutBadge(a?.workout_type)
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
  [WorkoutType.Other]: { pace: '—', rpe: '—' },
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
  [WorkoutType.Other]: 'muted',
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
  return isEasyWorkout(type) ? 'text-infoBright' : 'text-primaryBright'
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
