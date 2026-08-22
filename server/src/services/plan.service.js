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

export function buildRecommendationForType(trainingState, goal, zones, type) {
  const tpl = { ...WORKOUT_TEMPLATES[type] } || { ...WORKOUT_TEMPLATES.easy }
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
    reasons: [`Scheduled ${type} per your weekly plan${goal?.goal_type ? ` for ${goal.goal_type}` : ''}`],
  }
}

export function buildWeekPlan(trainingState, goal, startDate = new Date()) {
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
      if (isTaper) pattern = ['easy', 'easy', 'easy', 'long', 'easy'] // taper: volume down, intensity down
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
  return week
}
