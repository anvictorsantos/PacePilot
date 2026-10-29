/**
 * The activity families PacePilot reads. One enum for
 * every surface that must decide "is this a run?" — today the activity list, the
 * run-day completion rule and the badge copy.
 *
 * The wire value is the family, not the provider's raw label: the client
 * only needs to know what kind of session it was.
 */
export enum ActivityKind {
  Run = 'run',
  Ride = 'ride',
  Swim = 'swim',
  Strength = 'strength',
  Hiit = 'hiit',
  Mobility = 'mobility',
  Other = 'other',
}

export const ACTIVITY_KINDS: readonly ActivityKind[] = Object.values(ActivityKind)

/** Narrow a wire value to a known family; `null` when it is something else. */
export function toActivityKind(value: unknown): ActivityKind | null {
  const key = String(value ?? '').toLowerCase()
  return (ACTIVITY_KINDS as readonly string[]).includes(key) ? (key as ActivityKind) : null
}

export function isRunKind(value: unknown): boolean {
  return toActivityKind(value) === ActivityKind.Run
}

/**
 * Every family but a run is cross-training (CONTEXT.md §Canonical activity): a
 * real session that can complete the day, but never run volume, pace or count.
 */
export function isCrossTrainingKind(value: unknown): boolean {
  const kind = toActivityKind(value)
  return kind !== null && kind !== ActivityKind.Run
}
