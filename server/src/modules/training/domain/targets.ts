/**
 * Pace/HR targets — derived from 28d average pace and Strava HR zones.
 * Extracted from the Plan module (services/plan.service.ts).
 */
export function secToPace(s) {
  s = Math.max(120, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function targetPace(state, type) {
  const base = state.weekly?.avgPace28 || 360 // sec/km fallback ~6:00
  if (type === 'recovery') return `${secToPace(base + 30)}–${secToPace(base + 50)} /km`
  if (type === 'easy' || type === 'long') return `${secToPace(base - 5)}–${secToPace(base + 15)} /km`
  if (type === 'steady') return `${secToPace(base - 20)}–${secToPace(base - 5)} /km`
  if (type === 'tempo') return `${secToPace(base - 35)}–${secToPace(base - 20)} /km`
  if (type === 'threshold') return `${secToPace(base - 45)}–${secToPace(base - 30)} /km`
  if (type === 'interval') return `${secToPace(base - 60)}–${secToPace(base - 40)} /km`
  return `${secToPace(base - 5)}–${secToPace(base + 15)} /km`
}

export function targetHr(type, zones) {
  // Prefer Strava HR zones (Athlete.zones.heart_rate.zones or array payload) over hardcoded fallback.
  const hrZones = zones?.heart_rate?.zones || (Array.isArray(zones) ? zones.find(z => z.type === 'heartrate')?.zones : null) || null
  if (hrZones?.length) {
    const fmt = z => `${z.min}–${z.max} bpm`
    // Map workout intensity to zone(s): recovery Z1, easy Z2, long Z2, steady Z2–Z3, tempo Z3, threshold Z4, interval Z5
    const z = i => hrZones[Math.min(i, hrZones.length - 1)]
    if (type === 'recovery' && hrZones[0]) return fmt(z(0))
    if ((type === 'easy' || type === 'long') && hrZones[1]) return fmt(z(1))
    if (type === 'steady') {
      if (hrZones[2]) return `${z(1).min}–${z(2).max} bpm`
      return fmt(z(1))
    }
    if (type === 'tempo' && hrZones[2]) return fmt(z(2))
    if (type === 'threshold' && hrZones[3]) return fmt(z(3))
    if (type === 'interval' && hrZones[4]) return fmt(z(4))
    if (hrZones[0]) return fmt(z(0))
  }
  // Fallback (no zones yet) — keep previous hardcoded map but mark as estimate in caller if needed.
  const fallback = {
    recovery: '125–135 bpm', easy: '135–150 bpm', long: '135–152 bpm',
    steady: '150–162 bpm', tempo: '162–172 bpm', threshold: '168–178 bpm', interval: '172–185 bpm',
  }
  return fallback[type] || '135–150 bpm'
}
