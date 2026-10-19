/**
 * Movement types the plan prescribes (CONTEXT.md §Workout), plus the labels an
 * activity payload can carry: `race` (a Strava classification), `other` (a
 * synced activity that is not a run) and `unknown` (Strava sent nothing we
 * recognise).
 *
 * An enum rather than a string union: it is the single source for every
 * repeated literal in the client (badges, targets, tones, activity filters,
 * notification avatars), so a new type is one edit here and a compile error
 * everywhere a map must cover it.
 */
export enum WorkoutType {
  Rest = 'rest',
  Recovery = 'recovery',
  Easy = 'easy',
  Long = 'long',
  Steady = 'steady',
  Tempo = 'tempo',
  Threshold = 'threshold',
  Interval = 'interval',
  Intervals = 'intervals',
  Race = 'race',
  /** A synced activity that is not a run (ride, swim, HIIT, strength …). */
  Other = 'other',
  Unknown = 'unknown',
}

export const WORKOUT_TYPES: readonly WorkoutType[] = Object.values(WorkoutType)

/** Narrow a wire value to a known workout type; `null` when it is something else. */
export function toWorkoutType(value: unknown): WorkoutType | null {
  const key = String(value ?? '').toLowerCase()
  return (WORKOUT_TYPES as readonly string[]).includes(key) ? (key as WorkoutType) : null
}

export function isRestWorkout(value: unknown): boolean {
  return toWorkoutType(value) === WorkoutType.Rest
}

/** Rest or an unrecognised type — a slot with no training prescribed. */
export function isNonTrainingWorkout(value: unknown): boolean {
  const type = toWorkoutType(value)
  return type === WorkoutType.Rest || type === WorkoutType.Unknown
}

/** The types that count as quality work (CONTEXT.md §TrainingState, hard sessions). */
export function isHardWorkout(value: unknown): boolean {
  const type = toWorkoutType(value)
  return type === WorkoutType.Threshold || type === WorkoutType.Interval
}

/** The easy family — what the detail views read as cool-toned. */
export function isEasyWorkout(value: unknown): boolean {
  const type = toWorkoutType(value)
  return type === WorkoutType.Easy || type === WorkoutType.Recovery || type === WorkoutType.Long
}
