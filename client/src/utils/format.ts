/** Shared activity formatting — single source for pace/distance/duration strings (Pass 7). */

/** The payload fields these formatters read. Callers hold activity/lap objects
 *  loosely, so the exported parameters stay `unknown` and the cast happens once,
 *  here at the boundary. */
type ActivityLike = {
  avg_pace_sec_km?: number | null
  distance?: number | null
  moving_time?: number | null
  elapsed_time?: number | null
  distance_km?: number | null
  distance_m?: number | null
  moving_time_s?: number | null
  moving_time_min?: number | null
}

export function formatPace(sec: unknown): string {
  const n = Number(sec)
  if (sec == null || !isFinite(n)) return '—'
  const s = Math.max(120, Math.round(n))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`
}

export function formatActivityPace(a: unknown): string {
  const act = a as ActivityLike | null | undefined
  return formatPace(act?.avg_pace_sec_km ?? null)
}

export function formatLapPace(lap: unknown): string {
  const l = lap as ActivityLike | null | undefined
  const d = l?.distance ?? 0
  const t = l?.moving_time ?? l?.elapsed_time ?? 0
  if (!d || !t) return '—'
  return formatPace(t / (d / 1000))
}

export function formatDistanceKm(km: unknown): string {
  return km != null ? `${Number(km).toFixed(1)} km` : '—'
}

/** Compact plan label — "6 km", "6.5 km". No forced decimal: plan distances are
 *  round by construction and "6.0 km" reads as false precision next to the
 *  activity figures that do use one decimal. */
export function formatPlanDistance(km: unknown): string {
  if (km == null || !Number.isFinite(Number(km))) return '—'
  return `${Number(km)} km`
}

export function formatActivityDistance(a: unknown): string {
  const act = a as ActivityLike | null | undefined
  const distanceM = act?.distance_m
  const km = act?.distance_km ?? (distanceM != null ? distanceM / 1000 : null)
  return formatDistanceKm(km)
}

export function formatDuration(sec: unknown): string {
  if (sec == null) return '—'
  const s = Math.round(Number(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

export function formatActivityDuration(a: unknown): string {
  const act = a as ActivityLike | null | undefined
  const movingS = act?.moving_time_s
  const movingMin = act?.moving_time_min
  const sec = movingS ?? (movingMin != null ? Math.round(movingMin * 60) : null)
  return formatDuration(sec)
}

/** m:ss for short times (trophy efforts) — '' when unknown, matching detail view. */
export function formatShortTime(sec: unknown): string {
  if (sec == null) return ''
  const n = Number(sec)
  const m = Math.floor(n / 60)
  const s = n % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
