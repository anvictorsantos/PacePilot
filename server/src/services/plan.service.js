/**
 * Plan generation — deterministic, follows spec decision hierarchy:
 * 1 safety/recovery > 2 goal specificity > 3 consistency > 4 sustainable volume > 5 intensity > 6 specificity > 7 performance
 */

const WORKOUT_TEMPLATES = {
  recovery: { type: 'recovery', distance_km: 4, duration_min: 25, intensity: 'very easy', purpose: 'Active recovery and circulation' },
  easy: { type: 'easy', distance_km: 6, duration_min: 35, intensity: 'easy', purpose: 'Aerobic development without unnecessary fatigue' },
  long: { type: 'long', distance_km: 12, duration_min: 75, intensity: 'easy', purpose: 'Endurance and long-run progression' },
  steady: { type: 'steady', distance_km: 8, duration_min: 45, intensity: 'moderate', purpose: 'Sustained aerobic running' },
  tempo: { type: 'tempo', distance_km: 7, duration_min: 40, intensity: 'tempo', purpose: 'Lactate threshold development' },
  threshold: { type: 'threshold', distance_km: 8, duration_min: 45, intensity: 'threshold', purpose: 'Threshold and race-pace efficiency' },
  interval: { type: 'interval', distance_km: 7, duration_min: 45, intensity: 'hard', purpose: ' VO2max and speed development' },
}

function structureFor(type) {
  const map = {
    recovery: { warmup: '5 min very easy jog', main: '15–20 min very easy', cooldown: '5 min walk/jog' },
    easy: { warmup: '10 min very easy', main: '30–35 min easy, conversational', cooldown: '5 min relaxed cooldown' },
    long: { warmup: '10 min easy', main: '50–60 min easy, controlled', cooldown: '5–10 min easy cooldown' },
    steady: { warmup: '10 min easy', main: '30 min steady (comfortably hard)', cooldown: '5 min easy' },
    tempo: { warmup: '12 min easy + 4×20s strides', main: '20 min tempo (controlled, not maximal)', cooldown: '10 min easy' },
    threshold: { warmup: '12 min easy + drills', main: '3×6 min threshold w/ 2 min jog recoveries', cooldown: '10 min easy' },
    interval: { warmup: '12 min easy + 4×100m strides', main: '5×800m at 5K effort w/ 2 min jog', cooldown: '10 min easy' },
  }
  return map[type] || map.easy
}

function targetPace(state, type) {
  const base = state.weekly?.avgPace28 || 360 // sec/km fallback ~6:00
  if (type === 'recovery') return `${secToPace(base + 30)}–${secToPace(base + 50)} /km`
  if (type === 'easy' || type === 'long') return `${secToPace(base - 5)}–${secToPace(base + 15)} /km`
  if (type === 'steady') return `${secToPace(base - 20)}–${secToPace(base - 5)} /km`
  if (type === 'tempo') return `${secToPace(base - 35)}–${secToPace(base - 20)} /km`
  if (type === 'threshold') return `${secToPace(base - 45)}–${secToPace(base - 30)} /km`
  if (type === 'interval') return `${secToPace(base - 60)}–${secToPace(base - 40)} /km`
  return `${secToPace(base - 5)}–${secToPace(base + 15)} /km`
}
function secToPace(s) {
  s = Math.max(120, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function targetHr(type, zones) {
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

// --- Adaptive feedback (feel/skip + last-activity deviation) — instant, 7-day Feel Window, next workout only ---
const DOWNGRADE_ONE = { interval: 'threshold', threshold: 'tempo', tempo: 'steady', steady: 'easy', long: 'steady', easy: 'recovery', recovery: 'recovery' }
function downgradeOne(type) { return DOWNGRADE_ONE[type] || 'easy' }
function fmtShortDate(d) { try { return new Date(d).toISOString().slice(0,10) } catch { return String(d).slice(0,10) } }

function adaptiveFromFeedback(recentFeedbacks, baseType) {
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
  // table per Q10
  if (status === 'skipped') {
    if (rpe != null && rpe >= 10) return { type: 'rest', reason: `Rest — skipped with RPE 10 on ${d}` }
    if (rpe != null && rpe >= 9) return { type: 'recovery', reason: `Recovery after skipped workout with high effort (RPE ${rpe}) on ${d}` }
    return { type: 'easy', reason: `Eased after skipped workout on ${d}` }
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

function adaptiveFromLastActivity(activities, baseType) {
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

function adaptiveCombined(feedbacks, activities, baseType) {
  const fromFb = adaptiveFromFeedback(feedbacks, baseType)
  const fromAct = adaptiveFromLastActivity(activities, baseType)
  return pickMoreConservative(fromFb, fromAct)
}

export function recommendNextWorkout(trainingState, goal = null, zones = null) {
  const reasons = []
  let type = 'easy'

  // 1. Safety / fatigue
  if (trainingState.hasFatigueSignal) {
    reasons.push(...trainingState.fatigueSignals)
    if (trainingState.weekly.hardSessions7 >= 2) {
      type = 'recovery'
      reasons.push('Prioritizing recovery after hard sessions')
    } else {
      type = 'easy'
      reasons.push('Keeping effort easy to allow adaptation')
    }
  } else if (trainingState.weekly.hardSessions7 >= 2) {
    type = 'easy'
    reasons.push('Two hard sessions already this week — easy running to consolidate')
  } else if (trainingState.weekly.runs7 === 0) {
    type = 'easy'
    reasons.push('Returning to running — easy effort to re-establish rhythm')
  } else {
    // Goal-aware
    if (goal?.goal_type === 'marathon' || goal?.goal_type === 'half_marathon') {
      if (trainingState.weekly.longRun7 < (goal.goal_type === 'marathon' ? 16 : 10)) { type = 'long'; reasons.push('Building long-run progression toward goal distance') }
      else { type = 'steady'; reasons.push('Sustained aerobic work between long runs') }
    } else if (['5K', '10K'].includes(goal?.goal_type)) {
      // alternate hard/easy
      const lastHardDaysAgo = 3 // simplified; real engine would check actual last hard date
      if (trainingState.trend === 'stable' && trainingState.weekly.hardSessions7 === 0) { type = 'tempo'; reasons.push('Stable base — introducing controlled intensity') }
      else { type = 'easy'; reasons.push('Aerobic maintenance between quality sessions') }
    } else {
      type = trainingState.trend === 'building' ? 'easy' : 'steady'
      reasons.push(trainingState.trend === 'building' ? 'Volume has been building — easy day to absorb training' : 'Maintaining consistent aerobic stimulus')
    }
  }

  // Volume guard — don't jump long run
  const tpl = { ...WORKOUT_TEMPLATES[type] }
  const recentLong = trainingState.weekly.longRun28 || trainingState.weekly.longRun7 || 6
  if (type === 'long' && tpl.distance_km > recentLong + 2) tpl.distance_km = +(recentLong + 1.5).toFixed(1)

  const struct = structureFor(type)

  return {
    training_state: {
      weekly_distance_km: trainingState.weekly.distance7,
      runs_last_7_days: trainingState.weekly.runs7,
      long_run_km: trainingState.weekly.longRun7,
      hard_sessions_last_7_days: trainingState.weekly.hardSessions7,
      trend: trainingState.trend,
      fatigue_signals: trainingState.fatigueSignals,
    },
    recommendation: {
      type: tpl.type,
      distance_km: tpl.distance_km,
      duration_min: tpl.duration_min,
      intensity: tpl.intensity,
      purpose: tpl.purpose,
      warmup: struct.warmup,
      main_set: struct.main,
      cooldown: struct.cooldown,
      target_pace: targetPace(trainingState, type),
      target_hr: targetHr(type, zones),
      target_hr_source: zones ? 'strava' : 'estimate',
      alternative: 'If legs feel unusually heavy: reduce to 30–40 min very easy or take a recovery day.',
    },
    confidence: trainingState.hasFatigueSignal ? 0.72 : 0.82,
    reasons,
  }
}

const GOAL_LABELS = { half_marathon: 'Half Marathon', marathon: 'Marathon', distance_completion: 'Distance Completion', maintain: 'Maintain Fitness', general_fitness: 'General Fitness', '5K': '5K', '10K': '10K' }

export function buildRecommendationForType(trainingState, goal, zones, type, feedbacks = [], activities = []) {
  // adaptive: instant, next workout only — RPE+status (7d) + last-activity distance deviation vs plan
  const adapted = adaptiveCombined(feedbacks, activities, type)
  const effectiveType = adapted ? adapted.type : type
  // rest is a synthetic state — no template
  if (effectiveType === 'rest') {
    return {
      isRest: true,
      training_state: {
        weekly_distance_km: trainingState.weekly.distance7,
        runs_last_7_days: trainingState.weekly.runs7,
        long_run_km: trainingState.weekly.longRun7,
        hard_sessions_last_7_days: trainingState.weekly.hardSessions7,
        trend: trainingState.trend,
        fatigue_signals: trainingState.fatigueSignals,
      },
      recommendation: { type: 'rest', label: 'REST', distance_km: null, duration_min: null, intensity: 'rest', purpose: 'Recovery is training — no run scheduled', warmup: null, main_set: null, cooldown: null, target_pace: null, target_hr: null, target_hr_source: zones ? 'strava' : 'estimate', alternative: null },
      confidence: 0.82,
      reasons: [`Scheduled ${type} per your weekly plan${goal?.goal_type ? ` for ${GOAL_LABELS[goal.goal_type] || goal.goal_type}` : ''}`, adapted.reason, 'Adapted to rest based on recent feedback/activity'],
    }
  }
  const tpl = { ...WORKOUT_TEMPLATES[effectiveType] } || { ...WORKOUT_TEMPLATES.easy }
  const recentLong = trainingState.weekly.longRun28 || trainingState.weekly.longRun7 || 6
  if (effectiveType === 'long' && tpl.distance_km > recentLong + 2) tpl.distance_km = +(recentLong + 1.5).toFixed(1)
  const struct = structureFor(effectiveType)
  const reasons = [`Scheduled ${type} per your weekly plan${goal?.goal_type ? ` for ${GOAL_LABELS[goal.goal_type] || goal.goal_type}` : ''}`]
  if (adapted) {
    reasons.push(adapted.reason)
    if (effectiveType !== type) reasons.push(`Adapted: ${type} → ${effectiveType} based on recent feedback/activity`)
  }
  return {
    training_state: {
      weekly_distance_km: trainingState.weekly.distance7,
      runs_last_7_days: trainingState.weekly.runs7,
      long_run_km: trainingState.weekly.longRun7,
      hard_sessions_last_7_days: trainingState.weekly.hardSessions7,
      trend: trainingState.trend,
      fatigue_signals: trainingState.fatigueSignals,
    },
    recommendation: {
      type: tpl.type,
      distance_km: tpl.distance_km,
      duration_min: tpl.duration_min,
      intensity: tpl.intensity,
      purpose: tpl.purpose,
      warmup: struct.warmup,
      main_set: struct.main,
      cooldown: struct.cooldown,
      target_pace: targetPace(trainingState, effectiveType),
      target_hr: targetHr(effectiveType, zones),
      target_hr_source: zones ? 'strava' : 'estimate',
      alternative: 'If legs feel unusually heavy: reduce to 30–40 min very easy or take a recovery day.',
    },
    confidence: trainingState.hasFatigueSignal ? 0.72 : 0.82,
    reasons,
    adapted: adapted ? { from: type, to: effectiveType, reason: adapted.reason } : null,
  }
}

export function buildWeekPlan(trainingState, goal, startDate = new Date(), feedbacks = [], activities = []) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const preferred = goal?.preferred_days || ['Tuesday', 'Thursday', 'Saturday', 'Sunday']
  // Goal-date-aware taper/deload (ponytail: 7d taper, 14d deload; full periodization when needed)
  const goalDate = goal?.goal_date ? new Date(goal.goal_date) : null
  const daysUntilGoal = goalDate ? Math.ceil((goalDate - new Date(startDate).setHours(0,0,0,0)) / 86400000) : Infinity
  const isTaper = daysUntilGoal >= 0 && daysUntilGoal <= 7
  const isDeload = daysUntilGoal > 7 && daysUntilGoal <= 14
  // Simple mapping: preferred days get workouts, others rest
  const week = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
    const isPreferred = preferred.includes(dayName)
    const isToday = i === 0
    let workout
    if (!isPreferred) {
      workout = { type: 'rest', label: 'REST', distance: null, status: 'planned' }
    } else {
      const runIdx = week.filter(w => w.workout.type !== 'rest').length
      let pattern
      if (isTaper) pattern = ['easy', 'tempo', 'easy', 'long', 'easy'] // taper: volume down, intensity down
      else if (isDeload) pattern = ['easy', 'steady', 'easy', 'long']
      else pattern = ['easy', 'tempo', 'easy', 'long']
      const t = pattern[runIdx % pattern.length]
      const tpl = { ...WORKOUT_TEMPLATES[t] }
      if (isTaper && t === 'long') tpl.distance_km = Math.max(6, +(tpl.distance_km * 0.6).toFixed(1))
      else if (isDeload && t === 'long') tpl.distance_km = +(tpl.distance_km * 0.8).toFixed(1)
      workout = { type: t, label: t.toUpperCase(), distance: `${tpl.distance_km} KM`, status: isToday ? 'today' : 'planned' }
    }
    week.push({ day: days[d.getDay() === 0 ? 6 : d.getDay() - 1], date: d.toISOString().slice(0, 10), workout, isToday })
  }
  // adaptive: next workout only (Q8A) — swap isToday slot based on 7d Feel Window + last-activity deviation
  const todayEntry = week.find(w => w.isToday)
  if (todayEntry && todayEntry.workout.type !== 'rest') {
    const adapted = adaptiveCombined(feedbacks, activities, todayEntry.workout.type)
    if (adapted) {
      if (adapted.type === 'rest') {
        todayEntry.workout = { type: 'rest', label: 'REST', distance: null, status: 'adapted', originalType: todayEntry.workout.type, reason: adapted.reason }
      } else if (adapted.type !== todayEntry.workout.type) {
        const tpl = { ...WORKOUT_TEMPLATES[adapted.type] }
        todayEntry.workout = { type: adapted.type, label: adapted.type.toUpperCase(), distance: `${tpl.distance_km} KM`, status: 'adapted', originalType: todayEntry.workout.type, reason: adapted.reason }
      }
    }
  }
  return week
}
