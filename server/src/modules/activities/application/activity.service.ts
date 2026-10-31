// Pure normalisation and classification over canonical evidence: a provider payload
// never reaches this file, each adapter translates into `CanonicalActivity` first.

import { kindForSport, isRunSport } from '@/modules/activities/domain/value-object/Sport.ts'
import type {
  CanonicalActivity,
  CanonicalLap,
  CanonicalStreams,
} from '@/modules/providers/domain/CanonicalActivity.ts'

export interface ActivityLap {
  index: number
  distance: number | null
  moving_time: number | null
  elapsed_time: number | null
  avg_heartrate: number | null
  elev: number | null
  avg_pace_sec_km: number | null
}

/** The stream keys the pace/HR chart and the 3D map need, and the only ones we persist. */
export const ACTIVITY_STREAM_KEYS = ['time', 'distance', 'velocity_smooth', 'heartrate', 'latlng'] as const
export type ActivityStreamKey = (typeof ACTIVITY_STREAM_KEYS)[number]
/** A GPS sample: `[latitude, longitude]`. Null keeps the array index-aligned. */
export type ActivityLatLng = [number, number]
export interface ActivityStreams {
  time?: Array<number | null>
  distance?: Array<number | null>
  velocity_smooth?: Array<number | null>
  heartrate?: Array<number | null>
  latlng?: Array<ActivityLatLng | null>
}

export interface NormalizedStreams {
  streams: ActivityStreams
  available: ActivityStreamKey[]
}

/** Looser than the full normalized activity, so callers holding only pace/distance still work. */
export interface ClassifiableActivity {
  distance_km?: number | null
  distance_m?: number | null
  moving_time_min?: number | null
  moving_time_s?: number | null
  avg_pace_sec_km?: number | null
  avg_hr?: number | null
  elevation_m?: number | null
  laps?: unknown[] | null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeLaps(rawLaps: CanonicalLap[] | undefined): ActivityLap[] {
  if (!Array.isArray(rawLaps)) return []
  return rawLaps.map((lap, i) => ({
    index: i + 1,
    distance: lap.distanceM,
    moving_time: lap.movingTimeS,
    elapsed_time: lap.elapsedTimeS,
    avg_heartrate: lap.avgHr,
    elev: lap.elevationM,
    avg_pace_sec_km:
      lap.avgSpeedMps && lap.avgSpeedMps > 0 ? +(1000 / lap.avgSpeedMps).toFixed(0) : null,
  }))
}

export function normalizeStreams(raw: CanonicalStreams | null | undefined): NormalizedStreams {
  const streams: ActivityStreams = {}
  const available: ActivityStreamKey[] = []
  for (const key of ACTIVITY_STREAM_KEYS) {
    const value = raw?.[key]
    if (!Array.isArray(value) || value.length === 0) continue
    if (key === 'latlng') {
      const pairs = value.map((sample) => {
        if (!Array.isArray(sample) || sample.length < 2) return null
        const lat = finiteNumber(sample[0])
        const lng = finiteNumber(sample[1])
        return lat != null && lng != null ? ([lat, lng] as ActivityLatLng) : null
      })
      if (!pairs.length) continue
      streams.latlng = pairs
      available.push(key)
      continue
    }
    streams[key] = value as Array<number | null>
    available.push(key)
  }
  return { streams, available }
}

export function normalizeActivity(raw: CanonicalActivity) {
  const distance_m = raw.distanceM ?? 0
  const moving_s = raw.movingTimeS ?? 0
  const elapsed_s = raw.elapsedTimeS ?? 0
  const avg_speed =
    raw.avgSpeedMps ?? (distance_m && moving_s ? distance_m / moving_s : null)

  return {
    provider_activity_id: raw.externalId,
    date: raw.startedAt,
    sport: raw.sport,
    sport_type: raw.rawSport,
    kind: kindForSport(raw.sport),
    distance_m,
    distance_km: +(distance_m / 1000).toFixed(2),
    moving_time_s: moving_s,
    moving_time_min: +(moving_s / 60).toFixed(1),
    elapsed_time_s: elapsed_s,
    elapsed_time_min: +(elapsed_s / 60).toFixed(1),
    elevation_m: raw.elevationM ?? 0,
    avg_speed,
    max_speed: raw.maxSpeedMps ?? null,
    avg_pace_sec_km: avg_speed ? +(1000 / avg_speed).toFixed(0) : null,
    avg_hr: raw.avgHr ?? null,
    max_hr: raw.maxHr ?? null,
    avg_cadence: raw.avgCadenceSpm ?? null,
    has_hr: !!raw.hasHr,
    calories: raw.calories ?? null,
    achievement_count: raw.achievementCount ?? 0,
    pr_count: raw.prCount ?? 0,
    trophies: raw.trophies ?? [],
    // The list payload has no laps; a detailed read supplies them. Omitting the
    // key when absent keeps a re-sync from wiping laps enriched by the detail view.
    ...(Array.isArray(raw.laps) ? { laps: normalizeLaps(raw.laps) } : {}),
    zones: {},
    raw: raw.raw,
  }
}

/** Only runs feed volume. */
export function isRelevantRun(activity: Pick<CanonicalActivity, 'sport'>): boolean {
  return isRunSport(activity.sport)
}

/** Conservative multi-signal: recovery|easy|long|steady|tempo|threshold|interval|hill|race|unknown. */
export function classifyActivity(a: ClassifiableActivity, recentAvgPace: number | null = null): string {
  // `?? NaN`, not 0: a payload missing both units still classifies as no distance.
  const d = a.distance_km ?? (a.distance_m ?? NaN) / 1000
  const t = a.moving_time_min ?? (a.moving_time_s ?? NaN) / 60
  const pace = a.avg_pace_sec_km
  const hr = a.avg_hr
  const elev = a.elevation_m ?? 0
  const laps = a.laps || []

  if (d < 2) return 'recovery'

  if (d >= 14 || t >= 85) return 'long'

  if (laps.length >= 4) {
    const avgLapDist = d / laps.length
    if (avgLapDist < 1.5 && laps.length >= 6) return 'interval'
  }

  if (d > 0 && elev / d > 18) return 'hill'

  if (pace && recentAvgPace) {
    const ratio = pace / recentAvgPace
    if (ratio <= 0.88) {
      if (d >= 8 && t >= 40) return 'threshold'
      if (d >= 5) return 'tempo'
      return 'interval'
    }
    if (ratio <= 0.93) return 'steady'
    if (ratio >= 1.08) return 'recovery'
    return 'easy'
  }

  if (d >= 10) return 'long'
  if (d >= 5 && t >= 30) return 'easy'
  return 'unknown'
}
