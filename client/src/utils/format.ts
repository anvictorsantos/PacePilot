/** Shared activity formatting — single source for pace/distance/duration strings (Pass 7). */

export function formatPace(sec: unknown): string {
  if (sec == null || !isFinite(sec)) return '—'
  const s = Math.max(120, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`
}

export function formatActivityPace(a: unknown): string {
  return formatPace(a?.avg_pace_sec_km ?? null)
}

export function formatLapPace(lap: unknown): string {
  const d = lap?.distance ?? 0
  const t = lap?.moving_time ?? lap?.elapsed_time ?? 0
  if (!d || !t) return '—'
  return formatPace(t / (d / 1000))
}

export function formatDistanceKm(km: unknown): string {
  return km != null ? `${Number(km).toFixed(1)} km` : '—'
}

export function formatActivityDistance(a: unknown): string {
  const km = a?.distance_km ?? (a?.distance_m != null ? a.distance_m / 1000 : null)
  return formatDistanceKm(km)
}

export function formatDuration(sec: unknown): string {
  if (sec == null) return '—'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

export function formatActivityDuration(a: unknown): string {
  const sec =
    a?.moving_time_s ?? (a?.moving_time_min != null ? Math.round(a.moving_time_min * 60) : null)
  return formatDuration(sec)
}

/** m:ss for short times (trophy efforts) — '' when unknown, matching detail view. */
export function formatShortTime(sec: unknown): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
