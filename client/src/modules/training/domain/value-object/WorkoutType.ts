// Movement types the plan prescribes (CONTEXT.md §Workout) plus activity-only labels:
// `race`, `other` (synced non-run) and `unknown`. One enum so every map must cover a new type.
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

export function toWorkoutType(value: unknown): WorkoutType | null {
  const key = String(value ?? '').toLowerCase()
  return (WORKOUT_TYPES as readonly string[]).includes(key) ? (key as WorkoutType) : null
}

export function isRestWorkout(value: unknown): boolean {
  return toWorkoutType(value) === WorkoutType.Rest
}

export function isNonTrainingWorkout(value: unknown): boolean {
  const type = toWorkoutType(value)
  return type === WorkoutType.Rest || type === WorkoutType.Unknown
}

/** Quality work (CONTEXT.md §TrainingState, hard sessions). */
export function isHardWorkout(value: unknown): boolean {
  const type = toWorkoutType(value)
  return type === WorkoutType.Threshold || type === WorkoutType.Interval
}

/** The easy family — what the detail views read as cool-toned. */
export function isEasyWorkout(value: unknown): boolean {
  const type = toWorkoutType(value)
  return type === WorkoutType.Easy || type === WorkoutType.Recovery || type === WorkoutType.Long
}
