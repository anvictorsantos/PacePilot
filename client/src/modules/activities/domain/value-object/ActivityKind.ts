// Activity families; the wire value is the family, not the provider's raw label.
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

export function toActivityKind(value: unknown): ActivityKind | null {
  const key = String(value ?? '').toLowerCase()
  return (ACTIVITY_KINDS as readonly string[]).includes(key) ? (key as ActivityKind) : null
}

export function isRunKind(value: unknown): boolean {
  return toActivityKind(value) === ActivityKind.Run
}

// Every family but a run is cross-training (CONTEXT.md §Canonical activity): it can
// complete the day, never run volume, pace or count.
export function isCrossTrainingKind(value: unknown): boolean {
  const kind = toActivityKind(value)
  return kind !== null && kind !== ActivityKind.Run
}
