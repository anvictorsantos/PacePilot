/**
 * The activity families PacePilot reads. A provider's sport label is mapped
 * to exactly one kind; the kind is what the training engine reasons about.
 *
 * `run` is the only family that feeds distance/pace/run-count windows. The rest
 * are cross-training: they contribute load and can interfere with a quality run,
 * but they never become volume.
 *
 * A const object rather than a TS `enum`: the server runs through Node's
 * strip-only type removal, which rejects enum syntax.
 */
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
