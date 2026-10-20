/**
 * Normalization + classification — pure functions, no DB/Strava coupling.
 * Spec: conservative multi-signal, "unknown" when uncertain.
 *
 * Strava payloads are external data: the wire shape is declared here as an
 * all-optional contract and every field is narrowed on read. This file is the
 * anti-corruption layer between that payload and the Activity document.
 */

import { kindForSport } from '@/modules/activities/domain/value-object/SportType.ts'

/** A Strava segment achievement — `segment_efforts[].achievements[]`. */
interface StravaAchievement {
  rank?: number
  type?: string
  type_id?: number | null
}

/** A Strava segment effort — `StravaDetailedActivity.segment_efforts[]`. */
interface StravaSegmentEffort {
  segment?: { name?: string } | null
  name?: string
  elapsed_time?: number | null
  moving_time?: number | null
  achievements?: StravaAchievement[] | null
}

/** A Strava lap — `StravaDetailedActivity.laps[]`. */
interface StravaLap {
  distance?: number | null
  moving_time?: number | null
  elapsed_time?: number | null
  average_speed?: number | null
  average_heartrate?: number | null
  total_elevation_gain?: number | null
}

/** The Strava activity payload this module reads. Every field is optional —
 *  Strava omits fields per sport, and a partial payload must still normalize. */
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

/** One lap in the read model the detail view renders. */
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
/** Strava streams, flattened for our wire shape. */
export interface ActivityStreams {
  time?: Array<number | null>
  distance?: Array<number | null>
  velocity_smooth?: Array<number | null>
  heartrate?: Array<number | null>
  latlng?: Array<ActivityLatLng | null>
}

/** What Strava's `/streams` endpoint yields, flattened for our wire shape. */
export interface NormalizedStreams {
  streams: ActivityStreams
  available: ActivityStreamKey[]
}

/** A trophy derived from a segment achievement, cached onto the Activity. */
export interface Trophy {
  segment: string
  rank: number
  type: string
  type_id: number | null
  time: number | null
  label: string
}

/** The normalized fields `classifyActivity` reads. Looser than the full
 *  normalized activity so callers holding only pace/distance still work. */
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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']; const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function extractTrophies(raw: { segment_efforts?: StravaSegmentEffort[] | null }): Trophy[] {
  // Strava DetailedActivity.segment_efforts[].achievements → trophies like "Para acabar 2nd fastest time 1:45"
  // achievement.type: "overall" | "pr" | "kom" etc., rank: 1 is fastest/PR
  const efforts = raw.segment_efforts || []
  const trophies: Trophy[] = []
  for (const e of efforts) {
    const segmentName = e.segment?.name || e.name || 'Segment'
    const time = e.elapsed_time ?? e.moving_time ?? null
    for (const a of e.achievements || []) {
      const rank = a.rank ?? 1
      const type = a.type || 'overall'
      let label: string
      if (type === 'pr') label = 'PR'
      else if (type === 'kom' || type === 'overall') label = rank === 1 ? 'Fastest time' : `${ordinal(rank)} fastest time`
      else label = a.type || `${ordinal(rank)}`
      trophies.push({ segment: segmentName, rank, type, type_id: a.type_id ?? null, time, label })
    }
  }
  // sort PRs/KOMs first, then by rank
  trophies.sort((a, b) => (a.rank - b.rank) || (a.type === 'pr' ? -1 : 0))
  return trophies
}

/** A finite wire number, or null when Strava omitted/widened it. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Translate Strava's detailed-activity laps into the one shape LapsTable reads.
 * The index is positional: Strava lap ids are opaque and LapsTable only needs
 * "Lap 1, Lap 2 …".
 */
export function normalizeLaps(rawLaps: unknown): ActivityLap[] {
  if (!Array.isArray(rawLaps)) return []
  return rawLaps.map((entry, i) => {
    const lap = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
    const speed = finiteNumber(lap.average_speed)
    return {
      index: i + 1,
      distance: finiteNumber(lap.distance),
      moving_time: finiteNumber(lap.moving_time),
      elapsed_time: finiteNumber(lap.elapsed_time),
      avg_heartrate: finiteNumber(lap.average_heartrate),
      elev: finiteNumber(lap.total_elevation_gain),
      avg_pace_sec_km: speed && speed > 0 ? +(1000 / speed).toFixed(0) : null,
    }
  })
}

function streamValues(raw: unknown): Array<number | null> | null {
  const data =
    Array.isArray(raw) ? raw : (raw as { data?: unknown } | null | undefined)?.data
  if (!Array.isArray(data)) return null
  // Non-numeric samples become null rather than being dropped: the arrays are
  // aligned by index, and shifting one would mispair pace with distance.
  return data.map((value) => finiteNumber(value))
}

/** `latlng` is the one stream of pairs rather than scalars. */
function latLngValues(raw: unknown): Array<ActivityLatLng | null> | null {
  const data =
    Array.isArray(raw) ? raw : (raw as { data?: unknown } | null | undefined)?.data
  if (!Array.isArray(data)) return null
  return data.map((sample) => {
    if (!Array.isArray(sample) || sample.length < 2) return null
    const lat = finiteNumber(sample[0])
    const lng = finiteNumber(sample[1])
    return lat != null && lng != null ? ([lat, lng] as ActivityLatLng) : null
  })
}

/**
 * Flatten Strava streams. Accepts both wire shapes — `key_by_type=true` returns
 * `{ heartrate: { data: [...] } }`, the legacy form returns
 * `[{ type: 'heartrate', data: [...] }]` — and keeps only the keys we render.
 */
export function normalizeStreams(raw: unknown): NormalizedStreams {
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

  const streams: ActivityStreams = {}
  const available: ActivityStreamKey[] = []
  for (const key of ACTIVITY_STREAM_KEYS) {
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

export function normalizeActivity(raw: StravaActivityPayload) {
  const distance_m = raw.distance ?? 0
  const moving_s = raw.moving_time ?? 0
  const elapsed_s = raw.elapsed_time ?? 0
  const avg_speed = raw.average_speed ?? (distance_m && moving_s ? distance_m / moving_s : null)
  const sport_type = raw.sport_type || raw.type || raw.sport || 'Run'

  return {
    strava_activity_id: raw.id,
    date: raw.start_date ? new Date(raw.start_date) : new Date(),
    sport: raw.sport_type || raw.type || 'Run',
    sport_type,
    kind: kindForSport(sport_type),
    distance_m,
    distance_km: +(distance_m / 1000).toFixed(2),
    moving_time_s: moving_s,
    moving_time_min: +(moving_s / 60).toFixed(1),
    elapsed_time_s: elapsed_s,
    elapsed_time_min: +(elapsed_s / 60).toFixed(1),
    elevation_m: raw.total_elevation_gain ?? 0,
    avg_speed,
    max_speed: raw.max_speed ?? null,
    avg_pace_sec_km: avg_speed ? +(1000 / avg_speed).toFixed(0) : null,
    avg_hr: raw.average_heartrate ?? null,
    max_hr: raw.max_heartrate ?? null,
    avg_cadence: raw.average_cadence ? +(raw.average_cadence * 2).toFixed(0) : null, // Strava stores half
    has_hr: !!raw.has_heartrate,
    calories: raw.calories ?? null,
    achievement_count: raw.achievement_count ?? 0,
    pr_count: raw.pr_count ?? 0,
    trophies: extractTrophies(raw),
    // The list payload has no laps; a detailed read supplies them. Omitting the
    // key when absent keeps a re-sync from wiping laps enriched by the detail view.
    ...(Array.isArray(raw.laps) ? { laps: normalizeLaps(raw.laps) } : {}),
    zones: {},
    raw,
  }
}

/**
 * The sports that get pace/duration classification. Exported so the training
 * engine can select exactly the same rows the classifier understands — the two
 * queries must not drift.
 */
export const RUN_SPORTS = new Set(['Run', 'TrailRun', 'VirtualRun'])

/**
 * Whether a payload is a run. Since every activity is now imported, this no
 * longer gates the write: it decides run classification vs `other` tagging.
 */
export function isRelevantRun(activity: StravaActivityPayload): boolean {
  return RUN_SPORTS.has(activity.sport || activity.type || activity.sport_type || '')
}

/**
 * Conservative classification. Uses pace, duration, HR, lap structure, elevation.
 * Returns one of: recovery|easy|long|steady|tempo|threshold|interval|hill|race|unknown
 */
export function classifyActivity(a: ClassifiableActivity, recentAvgPace: number | null = null): string {
  // `?? NaN` keeps the old arithmetic: a payload missing both units still
  // yields NaN, not 0, so the "no distance" edge case classifies as before.
  const d = a.distance_km ?? (a.distance_m ?? NaN) / 1000
  const t = a.moving_time_min ?? (a.moving_time_s ?? NaN) / 60
  const pace = a.avg_pace_sec_km
  const hr = a.avg_hr
  const elev = a.elevation_m ?? 0
  const laps = a.laps || []

  // Very short → recovery or unknown if no other signal
  if (d < 2) return 'recovery'

  // Long run: duration or distance suggests long
  if (d >= 14 || t >= 85) return 'long'

  // Interval: lap structure with repeated efforts
  if (laps.length >= 4) {
    const avgLapDist = d / laps.length
    if (avgLapDist < 1.5 && laps.length >= 6) return 'interval'
  }

  // Hill: significant elevation relative to distance
  if (d > 0 && elev / d > 18) return 'hill'

  // Use pace relative to recent avg if available
  if (pace && recentAvgPace) {
    const ratio = pace / recentAvgPace
    if (ratio <= 0.88) {
      // Much faster than easy — tempo/threshold/race depending on distance
      if (d >= 8 && t >= 40) return 'threshold'
      if (d >= 5) return 'tempo'
      return 'interval'
    }
    if (ratio <= 0.93) return 'steady'
    if (ratio >= 1.08) return 'recovery'
    return 'easy'
  }

  // Without baseline: use duration/distance heuristics, else unknown
  if (d >= 10) return 'long'
  if (d >= 5 && t >= 30) return 'easy'
  return 'unknown'
}
