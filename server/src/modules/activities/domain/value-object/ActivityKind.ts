// `run` alone feeds distance/pace/run-count windows; the rest is cross-training — load
// that can interfere with a quality run but never volume. A const object, not an enum: Node's type stripping rejects enum syntax.
export const ActivityKind = {
  Run: 'run',
  Ride: 'ride',
  Swim: 'swim',
  Strength: 'strength',
  Hiit: 'hiit',
  Mobility: 'mobility',
  Other: 'other',
} as const

export type ActivityKind = (typeof ActivityKind)[keyof typeof ActivityKind]

export const ACTIVITY_KINDS: readonly ActivityKind[] = Object.values(ActivityKind)

/** Hard cross-training — the sessions that can interfere with a quality run. */
export function isHardCrossKind(kind: unknown): boolean {
  return kind === ActivityKind.Strength || kind === ActivityKind.Hiit
}

export function isRunKind(kind: unknown): boolean {
  return kind === ActivityKind.Run
}
