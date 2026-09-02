export function secPerKmToPace(sec) {
  if (!sec || !isFinite(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function msToMin(meters, seconds) {
  if (!meters || !seconds) return null
  return (seconds / 60) / (meters / 1000) // min per km via seconds
}

export function paceToSec(paceStr) {
  const [m, s] = paceStr.split(':').map(Number)
  return m * 60 + s
}

export function formatDistance(m) {
  if (m == null) return '—'
  return `${(m / 1000).toFixed(1)} km`
}

export function formatDuration(sec) {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${String(s).padStart(2, '0')}`
}
