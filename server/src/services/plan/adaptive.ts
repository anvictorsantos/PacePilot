/**
 * Adaptive feedback — instant, 7-day Feel Window, next workout only.
 * RPE/status signals + last-activity distance deviation vs plan.
 * Moved verbatim from plan.service.js (Pass 4: extract helpers).
 */
import { WORKOUT_TEMPLATES } from './templates.ts'

// --- Adaptive feedback (feel/skip + last-activity deviation) — instant, 7-day Feel Window, next workout only ---
const DOWNGRADE_ONE = { interval: 'threshold', threshold: 'tempo', tempo: 'steady', steady: 'easy', long: 'steady', easy: 'recovery', recovery: 'recovery' }
export function downgradeOne(type) { return DOWNGRADE_ONE[type] || 'easy' }
export function localDateStr(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export function fmtShortDate(d) { try { return localDateStr(d) } catch { return String(d).slice(0,10) } }

export function adaptiveFromFeedback(recentFeedbacks, baseType) {
  if (!recentFeedbacks?.length) return null
  // most recent within 7 days is the signal (fast decay per Q7:A)
  const now = Date.now()
  const sevenAgo = now - 7 * 86400000
  const recent = [...recentFeedbacks]
    .filter(f => { const t = new Date(f.date).getTime(); return !isNaN(t) && t >= sevenAgo && t <= now })
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  if (!recent) return null
  const rpe = recent.rpe != null ? Number(recent.rpe) : null
  const status = recent.status
  const d = fmtShortDate(recent.date)
  // table per Q10 — plain skip (no RPE) now goes to recovery 4km per user request (Thu + Sun 4km)
  if (status === 'skipped') {
    if (rpe != null && rpe >= 10) return { type: 'rest', reason: `Rest — skipped with RPE 10 on ${d}` }
    if (rpe != null && rpe >= 9) return { type: 'recovery', reason: `Recovery after skipped workout with high effort (RPE ${rpe}) on ${d}` }
    return { type: 'recovery', reason: `Recovery after skipped workout on ${d}` }
  }
  // completed / modified etc — trust rpe
  if (rpe != null && rpe >= 10) return { type: 'rest', reason: `Rest after maximal effort (RPE 10) on ${d}` }
  if (rpe != null && rpe >= 9) return { type: 'recovery', reason: `Recovery after high effort (RPE ${rpe}) on ${d}` }
  if (rpe != null && rpe >= 8) {
    const down = downgradeOne(baseType)
    if (down === baseType) return null
    return { type: down, reason: `Downgraded from ${baseType} to ${down} after elevated effort (RPE ${rpe}) on ${d}` }
  }
  return null
}

export function adaptiveFromLastActivity(activities, baseType) {
  if (!activities?.length) return null
  const sorted = [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const last = sorted[0]
  const t = new Date(last.date).getTime()
  if (isNaN(t) || Date.now() - t > 3 * 86400000) return null // stale >3d, don't adapt
  const tpl = WORKOUT_TEMPLATES[last.workout_type]
  if (!tpl || last.distance_km == null) return null
  if (['rest', 'unknown'].includes(last.workout_type)) return null
  const actual = Number(last.distance_km)
  const planned = tpl.distance_km
  const ratio = actual / planned
  const diff = actual - planned
  // overran: ran more than planned
  if (ratio >= 1.4 || diff >= 5) return { type: 'recovery', reason: `Recovery — last ${last.workout_type} ${actual.toFixed(1)}km vs ${planned}km planned (+${Math.round(ratio * 100 - 100)}%)` }
  if (ratio >= 1.25 || diff >= 2.5) {
    const down = downgradeOne(baseType)
    if (down !== baseType) return { type: down, reason: `Downgraded from ${baseType} to ${down} — last ${last.workout_type} was ${actual.toFixed(1)}km vs ${planned}km planned` }
  }
  // underran: cut short
  if (ratio <= 0.6) return { type: 'easy', reason: `Eased after short last run ${actual.toFixed(1)}km vs ${planned}km planned for ${last.workout_type}` }
  if (ratio <= 0.75) {
    const down = downgradeOne(baseType)
    if (down !== baseType) return { type: down, reason: `Downgraded after last run was lighter than planned (${actual.toFixed(1)}km vs ${planned}km)` }
  }
  return null
}

function pickMoreConservative(a, b) {
  if (!a) return b
  if (!b) return a
  const rank = t => t === 'rest' ? 3 : t === 'recovery' ? 2 : 1
  return rank(a.type) >= rank(b.type) ? a : b
}

export function adaptiveCombined(feedbacks, activities, baseType) {
  const fromFb = adaptiveFromFeedback(feedbacks, baseType)
  const fromAct = adaptiveFromLastActivity(activities, baseType)
  return pickMoreConservative(fromFb, fromAct)
}
