import { ActivityKind } from '@/modules/activities/domain/value-object/ActivityKind.ts'

/**
 * Every `sport_type` the Strava API can return (`GET /athlete/activities`), and
 * the PacePilot family it belongs to. Kept exhaustive on purpose: a value that
 * appears in a Strava response but not here would silently become `other`, so
 * the mapping is the documentation of what we understand.
 *
 * Strava exposes no per-exercise data on read (the `exercise_type` list in the
 * upload docs is write-only), so this is the finest granularity available.
 */
export const SPORT_KINDS: Readonly<Record<string, ActivityKind>> = {
  // Runs — the only family that counts as training volume.
  Run: ActivityKind.Run,
  TrailRun: ActivityKind.Run,
  VirtualRun: ActivityKind.Run,

  // Bike family.
  Ride: ActivityKind.Ride,
  VirtualRide: ActivityKind.Ride,
  EBikeRide: ActivityKind.Ride,
  EMountainBikeRide: ActivityKind.Ride,
  GravelRide: ActivityKind.Ride,
  MountainBikeRide: ActivityKind.Ride,

  Swim: ActivityKind.Swim,

  // Hard cross-training — interferes with quality sessions.
  WeightTraining: ActivityKind.Strength,
  Workout: ActivityKind.Strength,
  HighIntensityIntervalTraining: ActivityKind.Hiit,
  Crossfit: ActivityKind.Hiit,

  // Recovery / mobility — load only, never interference.
  Yoga: ActivityKind.Mobility,
  Pilates: ActivityKind.Mobility,
  PhysicalTherapy: ActivityKind.Mobility,

  // Everything else: aerobic cross-load or no meaningful load.
  AlpineSki: ActivityKind.Other,
  BackcountrySki: ActivityKind.Other,
  Badminton: ActivityKind.Other,
  Basketball: ActivityKind.Other,
  Canoeing: ActivityKind.Other,
  Cricket: ActivityKind.Other,
  Dance: ActivityKind.Other,
  Elliptical: ActivityKind.Other,
  Golf: ActivityKind.Other,
  Handcycle: ActivityKind.Other,
  Hike: ActivityKind.Other,
  IceSkate: ActivityKind.Other,
  InlineSkate: ActivityKind.Other,
  Kayaking: ActivityKind.Other,
  Kitesurf: ActivityKind.Other,
  NordicSki: ActivityKind.Other,
  Padel: ActivityKind.Other,
  Pickleball: ActivityKind.Other,
  Racquetball: ActivityKind.Other,
  RockClimbing: ActivityKind.Other,
  RollerSki: ActivityKind.Other,
  Rowing: ActivityKind.Other,
  Sail: ActivityKind.Other,
  Skateboard: ActivityKind.Other,
  Snowboard: ActivityKind.Other,
  Snowshoe: ActivityKind.Other,
  Soccer: ActivityKind.Other,
  Squash: ActivityKind.Other,
  StairStepper: ActivityKind.Other,
  StandUpPaddling: ActivityKind.Other,
  Surfing: ActivityKind.Other,
  TableTennis: ActivityKind.Other,
  Tennis: ActivityKind.Other,
  Velomobile: ActivityKind.Other,
  VirtualRow: ActivityKind.Other,
  Volleyball: ActivityKind.Other,
  Walk: ActivityKind.Other,
  Wheelchair: ActivityKind.Other,
  Windsurf: ActivityKind.Other,
}

/** The family for a Strava sport. Unknown or missing → `other`, never a run. */
export function kindForSport(sportType: string | null | undefined): ActivityKind {
  return SPORT_KINDS[sportType ?? ''] ?? ActivityKind.Other
}

/** The family of a stored activity: its explicit `kind`, else derived from the sport. */
export function kindOfActivity(activity: {
  kind?: string | null
  sport_type?: string | null
  sport?: string | null
}): ActivityKind {
  if (activity.kind) return activity.kind as ActivityKind
  const sport = activity.sport_type ?? activity.sport
  // Pre-`kind` documents came from a runs-only import, so no sport means a run.
  if (!sport) return ActivityKind.Run
  return kindForSport(sport)
}
