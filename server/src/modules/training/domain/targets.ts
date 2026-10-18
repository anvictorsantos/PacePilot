/**
 * Pace/HR targets — derived from 28d average pace and Strava HR zones.
 * Extracted from the Plan module (services/plan.service.ts).
 */
import type { TrainingState } from '@/modules/training/domain/training-state.ts'

export interface HrZone { min: number; max: number }

/** The shapes a `zones` payload arrives in: an athlete object, or a Strava
 *  array of { type, zones } groups. Translated here, at the boundary. */
export type ZonesInput =
  | { heart_rate?: { zones?: HrZone[] } }
  | Array<{ type?: string; zones?: HrZone[] }>
  | null
  | undefined

export function secToPace(s: number): string {
  s = Math.max(120, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function targetPace(state: TrainingState, type: string): string {
  const base = state.weekly?.avgPace28 || 360 // sec/km fallback ~6:00
  if (type === 'recovery') return `${secToPace(base + 30)}–${secToPace(base + 50)} /km`
  if (type === 'easy' || type === 'long') return `${secToPace(base - 5)}–${secToPace(base + 15)} /km`
  if (type === 'steady') return `${secToPace(base - 20)}–${secToPace(base - 5)} /km`
  if (type === 'tempo') return `${secToPace(base - 35)}–${secToPace(base - 20)} /km`
  if (type === 'threshold') return `${secToPace(base - 45)}–${secToPace(base - 30)} /km`
  if (type === 'interval') return `${secToPace(base - 60)}–${secToPace(base - 40)} /km`
  return `${secToPace(base - 5)}–${secToPace(base + 15)} /km`
}

export function targetHr(type: string, zones: ZonesInput): string {
  // Prefer Strava HR zones (Athlete.zones.heart_rate.zones or array payload) over hardcoded fallback.
  const hrZones = Array.isArray(zones)
    ? zones.find(z => z.type === 'heartrate')?.zones || null
    : zones?.heart_rate?.zones || null
  if (hrZones?.length) {
    const fmt = (z: HrZone) => `${z.min}–${z.max} bpm`
    // Map workout intensity to zone(s): recovery Z1, easy Z2, long Z2, steady Z2–Z3, tempo Z3, threshold Z4, interval Z5
    const z = (i: number) => hrZones[Math.min(i, hrZones.length - 1)]
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
  const fallback: Record<string, string> = {
    recovery: '125–135 bpm', easy: '135–150 bpm', long: '135–152 bpm',
    steady: '150–162 bpm', tempo: '162–172 bpm', threshold: '168–178 bpm', interval: '172–185 bpm',
  }
  return fallback[type] || '135–150 bpm'
}
