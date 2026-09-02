/**
 * Normalization + classification — pure functions, no DB/Strava coupling.
 * Spec: conservative multi-signal, "unknown" when uncertain.
 */

export function normalizeActivity(raw) {
  const distance_m = raw.distance ?? 0
  const moving_s = raw.moving_time ?? 0
  const elapsed_s = raw.elapsed_time ?? 0
  const avg_speed = raw.average_speed ?? (distance_m && moving_s ? distance_m / moving_s : null)

  return {
    strava_activity_id: raw.id,
    date: raw.start_date ? new Date(raw.start_date) : new Date(),
    sport: raw.sport_type || raw.type || 'Run',
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
    laps: [],
    zones: {},
    streams_available: [],
    raw,
  }
}

const RUN_SPORTS = new Set(['Run', 'TrailRun', 'VirtualRun'])

export function isRelevantRun(activity) {
  return RUN_SPORTS.has(activity.sport || activity.type || activity.sport_type)
}

/**
 * Conservative classification. Uses pace, duration, HR, lap structure, elevation.
 * Returns one of: recovery|easy|long|steady|tempo|threshold|interval|hill|race|unknown
 */
export function classifyActivity(a, recentAvgPace = null) {
  const d = a.distance_km ?? a.distance_m / 1000
  const t = a.moving_time_min ?? a.moving_time_s / 60
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
