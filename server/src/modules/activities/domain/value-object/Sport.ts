import { ActivityKind } from '@/modules/activities/domain/value-object/ActivityKind.ts'

// Canonical vocabulary: each provider adapter translates its own labels (`Run`,
// `running`, `trail_running`) before anything else sees them.
export const Sport = {
  Run: 'run',
  TrailRun: 'trail_run',
  TreadmillRun: 'treadmill_run',
  Ride: 'ride',
  Swim: 'swim',
  Strength: 'strength',
  Hiit: 'hiit',
  Mobility: 'mobility',
  Other: 'other',
} as const

export type Sport = (typeof Sport)[keyof typeof Sport]

export const SPORTS: readonly Sport[] = Object.values(Sport)

const RUN_SPORTS: ReadonlySet<Sport> = new Set([
  Sport.Run,
  Sport.TrailRun,
  Sport.TreadmillRun,
])

const KIND_BY_SPORT: Readonly<Record<Sport, ActivityKind>> = {
  [Sport.Run]: ActivityKind.Run,
  [Sport.TrailRun]: ActivityKind.Run,
  [Sport.TreadmillRun]: ActivityKind.Run,
  [Sport.Ride]: ActivityKind.Ride,
  [Sport.Swim]: ActivityKind.Swim,
  [Sport.Strength]: ActivityKind.Strength,
  [Sport.Hiit]: ActivityKind.Hiit,
  [Sport.Mobility]: ActivityKind.Mobility,
  [Sport.Other]: ActivityKind.Other,
}

/** The training family for a canonical sport. Unknown → `other`, never a run. */
export function kindForSport(sport: Sport | string | null | undefined): ActivityKind {
  if (typeof sport !== 'string') return ActivityKind.Other
  return KIND_BY_SPORT[sport as Sport] ?? ActivityKind.Other
}

export function isRunSport(sport: Sport | string | null | undefined): boolean {
  return typeof sport === 'string' && RUN_SPORTS.has(sport as Sport)
}

// Stored activity family: explicit `kind`, else derived from the sport. A pre-`kind`
// document only ever came from the runs-only import, so no sport means a run.
export function kindOfActivity(activity: {
  kind?: string | null
  sport_type?: string | null
  sport?: string | null
}): ActivityKind {
  if (activity.kind) return activity.kind as ActivityKind
  const sport = activity.sport_type ?? activity.sport
  if (!sport) return ActivityKind.Run
  return kindForSport(sport)
}
