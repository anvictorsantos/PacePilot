// Adaptive feedback — instant, 7-day Feel Window, next workout only.
// RPE/status signals plus last-activity distance deviation versus the plan.
import { WORKOUT_TEMPLATES } from '@/modules/training/domain/templates.ts'
import type { ActivityRecord } from '@/modules/training/domain/training-state.ts'
import { ActivityKind, isHardCrossKind } from '@/modules/activities/domain/value-object/ActivityKind.ts'
import { kindOfActivity } from '@/modules/activities/domain/value-object/SportType.ts'

export interface Feedback {
  date: string | number | Date
  status?: string | null
  rpe?: number | string | null
  note?: string
  notes?: string
}

export interface AdaptiveChange { type: string; reason: string }

const DOWNGRADE_ONE: Record<string, string> = { interval: 'threshold', threshold: 'tempo', tempo: 'steady', steady: 'easy', long: 'steady', easy: 'recovery', recovery: 'recovery' }
export function downgradeOne(type: string): string { return DOWNGRADE_ONE[type] || 'easy' }
export function localDateStr(d: string | number | Date): string { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export function fmtShortDate(d: string | number | Date): string { try { return localDateStr(d) } catch { return String(d).slice(0,10) } }

export function adaptiveFromFeedback(recentFeedbacks: Feedback[] | null | undefined, baseType: string): AdaptiveChange | null {
  if (!recentFeedbacks?.length) return null
  // most recent within 7 days is the signal (fast decay per Q7:A)
  const now = Date.now()
  const sevenAgo = now - 7 * 86400000
  const recent = [...recentFeedbacks]
    .filter(f => { const t = new Date(f.date).getTime(); return !isNaN(t) && t >= sevenAgo && t <= now })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
  if (!recent) return null
  const rpe = recent.rpe != null ? Number(recent.rpe) : null
  const status = recent.status
  const d = fmtShortDate(recent.date)
  // table per Q10 — plain skip (no RPE) goes to recovery 4km per user request (Thu + Sun 4km)
  if (status === 'skipped') {
    if (rpe != null && rpe >= 10) return { type: 'rest', reason: `Rest — skipped with RPE 10 on ${d}` }
    if (rpe != null && rpe >= 9) return { type: 'recovery', reason: `Recovery after skipped workout with high effort (RPE ${rpe}) on ${d}` }
    return { type: 'recovery', reason: `Recovery after skipped workout on ${d}` }
  }
  if (rpe != null && rpe >= 10) return { type: 'rest', reason: `Rest after maximal effort (RPE 10) on ${d}` }
  if (rpe != null && rpe >= 9) return { type: 'recovery', reason: `Recovery after high effort (RPE ${rpe}) on ${d}` }
  if (rpe != null && rpe >= 8) {
    const down = downgradeOne(baseType)
    if (down === baseType) return null
    return { type: down, reason: `Downgraded from ${baseType} to ${down} after elevated effort (RPE ${rpe}) on ${d}` }
  }
  return null
}

export function adaptiveFromLastActivity(activities: ActivityRecord[] | null | undefined, baseType: string): AdaptiveChange | null {
  // Runs only: a HIIT session has no pace/distance template and must not read as
  // the last run. Cross-training interference is its own signal below.
  const runs = (activities ?? []).filter((a) => kindOfActivity(a) === ActivityKind.Run)
  if (!runs.length) return null
  const sorted = [...runs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const last = sorted[0]
  const t = new Date(last.date).getTime()
  if (isNaN(t) || Date.now() - t > 3 * 86400000) return null
  const tpl = WORKOUT_TEMPLATES[last.workout_type]
  if (!tpl || last.distance_km == null) return null
  if (['rest', 'unknown'].includes(last.workout_type)) return null
  const actual = Number(last.distance_km)
  const planned = tpl.distance_km
  const ratio = actual / planned
  const diff = actual - planned
  if (ratio >= 1.4 || diff >= 5) return { type: 'recovery', reason: `Recovery — last ${last.workout_type} ${actual.toFixed(1)}km vs ${planned}km planned (+${Math.round(ratio * 100 - 100)}%)` }
  if (ratio >= 1.25 || diff >= 2.5) {
    const down = downgradeOne(baseType)
    if (down !== baseType) return { type: down, reason: `Downgraded from ${baseType} to ${down} — last ${last.workout_type} was ${actual.toFixed(1)}km vs ${planned}km planned` }
  }
  if (ratio <= 0.6) return { type: 'easy', reason: `Eased after short last run ${actual.toFixed(1)}km vs ${planned}km planned for ${last.workout_type}` }
  if (ratio <= 0.75) {
    const down = downgradeOne(baseType)
    if (down !== baseType) return { type: down, reason: `Downgraded after last run was lighter than planned (${actual.toFixed(1)}km vs ${planned}km)` }
  }
  return null
}

function pickMoreConservative(a: AdaptiveChange | null, b: AdaptiveChange | null): AdaptiveChange | null {
  if (!a) return b
  if (!b) return a
  const rank = (t: string) => t === 'rest' ? 3 : t === 'recovery' ? 2 : 1
  return rank(a.type) >= rank(b.type) ? a : b
}

const HOUR_MS = 3_600_000
const QUALITY_TYPES = ['interval', 'threshold', 'tempo', 'race']

// Cross-training interference: a hard HIIT or strength session within a day, or stacked within
// a day of a hard run, downgrades the next quality slot one step. Deliberately conservative.
export function adaptiveFromInterference(
  activities: ActivityRecord[] | null | undefined,
  baseType: string,
  now = Date.now(),
): AdaptiveChange | null {
  if (!QUALITY_TYPES.includes(baseType)) return null
  const all = activities ?? []
  const lastCross = all
    .filter((a) => isHardCrossKind(kindOfActivity(a)))
    .map((a) => ({ a, t: new Date(a.date).getTime() }))
    .filter((x) => Number.isFinite(x.t) && x.t <= now)
    .sort((x, y) => y.t - x.t)[0]
  if (!lastCross) return null

  const age = now - lastCross.t
  if (age > 48 * HOUR_MS) return null

  const hardRunNearby = all.some((a) => {
    if (kindOfActivity(a) !== ActivityKind.Run) return false
    if (!QUALITY_TYPES.includes(a.workout_type)) return false
    const t = new Date(a.date).getTime()
    return Number.isFinite(t) && Math.abs(t - lastCross.t) <= 24 * HOUR_MS
  })

  const direct = age <= 24 * HOUR_MS
  if (!direct && !hardRunNearby) return null

  const down = downgradeOne(baseType)
  if (down === baseType) return null

  const kind = kindOfActivity(lastCross.a)
  const reason =
    hardRunNearby && !direct
      ? `Downgraded from ${baseType} to ${down} — hard ${kind} session stacked with a hard run in the last 48h`
      : `Downgraded from ${baseType} to ${down} — hard ${kind} session ${Math.max(1, Math.round(age / HOUR_MS))}h ago`
  return { type: down, reason }
}

export function adaptiveCombined(feedbacks: Feedback[] | null | undefined, activities: ActivityRecord[] | null | undefined, baseType: string): AdaptiveChange | null {
  const fromFb = adaptiveFromFeedback(feedbacks, baseType)
  const fromAct = adaptiveFromLastActivity(activities, baseType)
  const fromCross = adaptiveFromInterference(activities, baseType)
  return pickMoreConservative(pickMoreConservative(fromFb, fromAct), fromCross)
}
