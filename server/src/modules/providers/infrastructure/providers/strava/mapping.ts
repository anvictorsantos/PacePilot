/**
 * Strava's payload → the canonical evidence shape. This is the anti-corruption
 * layer: the rest of the server never reads `sport_type`, `average_speed` or
 * `segment_efforts`.
 */
import type {
  CanonicalActivity,
  CanonicalLap,
  CanonicalStreams,
  CanonicalTrophy,
} from '@/modules/providers/domain/CanonicalActivity.ts'
import { Sport } from '@/modules/activities/domain/value-object/Sport.ts'

/** A Strava segment achievement — `segment_efforts[].achievements[]`. */
interface StravaAchievement {
  rank?: number
  type?: string
  type_id?: number | null
}

interface StravaSegmentEffort {
  segment?: { name?: string } | null
  name?: string
  elapsed_time?: number | null
  moving_time?: number | null
  achievements?: StravaAchievement[] | null
}

interface StravaLap {
  distance?: number | null
  moving_time?: number | null
  elapsed_time?: number | null
  average_speed?: number | null
  average_heartrate?: number | null
  total_elevation_gain?: number | null
}

/** Every field optional: Strava omits different fields per sport. */
export interface StravaActivityPayload {
  id?: number
  sport?: string
  sport_type?: string
  type?: string
  start_date?: string
  distance?: number
  moving_time?: number
  elapsed_time?: number
  average_speed?: number
  max_speed?: number | null
  total_elevation_gain?: number
  average_heartrate?: number | null
  max_heartrate?: number | null
  average_cadence?: number | null
  has_heartrate?: boolean
  calories?: number | null
  achievement_count?: number
  pr_count?: number
  segment_efforts?: StravaSegmentEffort[] | null
  laps?: StravaLap[] | null
  [key: string]: unknown
}

/**
 * Every `sport_type` the Strava API can return, mapped to the canonical sport.
 * Kept exhaustive: a new value appearing in a response becomes `other` only
 * through a deliberate edit here.
 */
export const STRAVA_SPORT_MAP: Readonly<Record<string, Sport>> = {
  Run: Sport.Run,
  TrailRun: Sport.TrailRun,
  VirtualRun: Sport.TreadmillRun,

  Ride: Sport.Ride,
  VirtualRide: Sport.Ride,
  EBikeRide: Sport.Ride,
  EMountainBikeRide: Sport.Ride,
  GravelRide: Sport.Ride,
  MountainBikeRide: Sport.Ride,

  Swim: Sport.Swim,

  WeightTraining: Sport.Strength,
  Workout: Sport.Strength,
  HighIntensityIntervalTraining: Sport.Hiit,
  Crossfit: Sport.Hiit,

  Yoga: Sport.Mobility,
  Pilates: Sport.Mobility,
  PhysicalTherapy: Sport.Mobility,

  AlpineSki: Sport.Other,
  BackcountrySki: Sport.Other,
  Badminton: Sport.Other,
  Basketball: Sport.Other,
  Canoeing: Sport.Other,
  Cricket: Sport.Other,
  Dance: Sport.Other,
  Elliptical: Sport.Other,
  Golf: Sport.Other,
  Handcycle: Sport.Other,
  Hike: Sport.Other,
  IceSkate: Sport.Other,
  InlineSkate: Sport.Other,
  Kayaking: Sport.Other,
  Kitesurf: Sport.Other,
  NordicSki: Sport.Other,
  Padel: Sport.Other,
  Pickleball: Sport.Other,
  Racquetball: Sport.Other,
  RockClimbing: Sport.Other,
  RollerSki: Sport.Other,
  Rowing: Sport.Other,
  Sail: Sport.Other,
  Skateboard: Sport.Other,
  Snowboard: Sport.Other,
  Snowshoe: Sport.Other,
  Soccer: Sport.Other,
  Squash: Sport.Other,
  StairStepper: Sport.Other,
  StandUpPaddling: Sport.Other,
  Surfing: Sport.Other,
  TableTennis: Sport.Other,
  Tennis: Sport.Other,
  Velomobile: Sport.Other,
  VirtualRow: Sport.Other,
  Volleyball: Sport.Other,
  Walk: Sport.Other,
  Wheelchair: Sport.Other,
  Windsurf: Sport.Other,
}

export function sportForStrava(rawSport: string | null | undefined): Sport {
  return STRAVA_SPORT_MAP[rawSport ?? ''] ?? Sport.Other
}

export function rawSportOf(raw: StravaActivityPayload): string {
  return raw.sport_type || raw.type || raw.sport || 'Run'
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function mapTrophies(raw: { segment_efforts?: StravaSegmentEffort[] | null }): CanonicalTrophy[] {
  const efforts = raw.segment_efforts || []
  const trophies: CanonicalTrophy[] = []
  for (const effort of efforts) {
    const segment = effort.segment?.name || effort.name || 'Segment'
    const time = effort.elapsed_time ?? effort.moving_time ?? null
    for (const achievement of effort.achievements || []) {
      const rank = achievement.rank ?? 1
      const type = achievement.type || 'overall'
      let label: string
      if (type === 'pr') label = 'PR'
      else if (type === 'kom' || type === 'overall') {
        label = rank === 1 ? 'Fastest time' : `${ordinal(rank)} fastest time`
      } else label = type
      trophies.push({
        segment,
        rank,
        type,
        typeId: achievement.type_id ?? null,
        time,
        label,
      })
    }
  }
  trophies.sort((a, b) => a.rank - b.rank || (a.type === 'pr' ? -1 : 0))
  return trophies
}

export function mapLaps(rawLaps: unknown): CanonicalLap[] {
  if (!Array.isArray(rawLaps)) return []
  return rawLaps.map((entry) => {
    const lap = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
    return {
      distanceM: finiteNumber(lap.distance),
      movingTimeS: finiteNumber(lap.moving_time),
      elapsedTimeS: finiteNumber(lap.elapsed_time),
      avgSpeedMps: finiteNumber(lap.average_speed),
      avgHr: finiteNumber(lap.average_heartrate),
      elevationM: finiteNumber(lap.total_elevation_gain),
    }
  })
}

function streamValues(raw: unknown): Array<number | null> | null {
  const data = Array.isArray(raw) ? raw : (raw as { data?: unknown } | null | undefined)?.data
  if (!Array.isArray(data)) return null
  // Non-numeric samples become null rather than being dropped: arrays are
  // index-aligned, and shifting one would mispair pace with distance.
  return data.map((value) => finiteNumber(value))
}

function latLngValues(raw: unknown): Array<[number, number] | null> | null {
  const data = Array.isArray(raw) ? raw : (raw as { data?: unknown } | null | undefined)?.data
  if (!Array.isArray(data)) return null
  return data.map((sample) => {
    if (!Array.isArray(sample) || sample.length < 2) return null
    const lat = finiteNumber(sample[0])
    const lng = finiteNumber(sample[1])
    return lat != null && lng != null ? ([lat, lng] as [number, number]) : null
  })
}

const STREAM_KEYS = ['time', 'distance', 'velocity_smooth', 'heartrate', 'latlng'] as const
export type CanonicalStreamKey = (typeof STREAM_KEYS)[number]

/** Flatten both Strava stream shapes (`key_by_type` object or legacy array). */
export function mapStreams(raw: unknown): { streams: CanonicalStreams; available: CanonicalStreamKey[] } {
  const byKey = new Map<string, unknown>()
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue
      const stream = entry as { type?: unknown; data?: unknown }
      if (typeof stream.type === 'string') byKey.set(stream.type, stream.data)
    }
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) byKey.set(key, value)
  }

  const streams: CanonicalStreams = {}
  const available: CanonicalStreamKey[] = []
  for (const key of STREAM_KEYS) {
    if (key === 'latlng') {
      const pairs = latLngValues(byKey.get(key))
      if (!pairs?.length) continue
      streams.latlng = pairs
      available.push(key)
      continue
    }
    const values = streamValues(byKey.get(key))
    if (!values?.length) continue
    streams[key] = values
    available.push(key)
  }
  return { streams, available }
}

export function mapActivity(raw: StravaActivityPayload): CanonicalActivity {
  const distanceM = raw.distance ?? 0
  const movingTimeS = raw.moving_time ?? 0
  const avgSpeedMps = raw.average_speed ?? (distanceM && movingTimeS ? distanceM / movingTimeS : null)
  const rawSport = rawSportOf(raw)
  return {
    externalId: String(raw.id ?? ''),
    startedAt: raw.start_date ? new Date(raw.start_date) : new Date(),
    rawSport,
    sport: sportForStrava(rawSport),
    distanceM,
    movingTimeS,
    elapsedTimeS: raw.elapsed_time ?? 0,
    avgSpeedMps,
    maxSpeedMps: raw.max_speed ?? null,
    elevationM: raw.total_elevation_gain ?? 0,
    avgHr: raw.average_heartrate ?? null,
    maxHr: raw.max_heartrate ?? null,
    // Strava stores cadence as steps per leg.
    avgCadenceSpm: raw.average_cadence ? +(raw.average_cadence * 2).toFixed(0) : null,
    hasHr: !!raw.has_heartrate,
    calories: raw.calories ?? null,
    achievementCount: raw.achievement_count ?? 0,
    prCount: raw.pr_count ?? 0,
    trophies: mapTrophies(raw),
    // The list payload has no laps; a detailed read supplies them. Omitting the
    // key when absent keeps a re-sync from wiping laps enriched by the detail view.
    ...(Array.isArray(raw.laps) ? { laps: mapLaps(raw.laps) } : {}),
    raw,
  }
}
