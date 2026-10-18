/**
 * The Plan module — one place that knows how to load an athlete's training data
 * and derive the Week, the Next Workout and the week metadata from it.
 *
 * Deterministic, and follows the spec decision hierarchy: 1 safety/recovery >
 * 2 goal specificity > 3 consistency > 4 sustainable volume > 5 intensity >
 * 6 specificity > 7 performance.
 *
 * Before this module existed, every route in `routes/plan.routes.ts` (and
 * `progress.routes.ts`) re-assembled the same four-step chain by hand —
 * `getRequestContext` → `calcTrainingState` → `buildWeekPlan` → `getWeekMeta` —
 * and nothing said that order was load-bearing. The interface is now three
 * calls: `planWeek`, `planToday`, and `loadTrainingData` for the read models
 * that want the raw activity/state pair.
 *
 * Helpers stay in ./plan/: templates.ts (shapes), targets.ts (pace/HR),
 * adaptive.ts (RPE/skip adaptation), weekMeta.ts (week anchoring),
 * programme.ts (programme-driven day assignment).
 */
import mongoose from 'mongoose'
import { Activity } from '../models/Activity.ts'
import { Athlete } from '../models/Athlete.ts'
import { WorkoutFeedback } from '../models/WorkoutFeedback.ts'
import { serviceUnavailable } from '../errors/AppError.ts'
import { calcTrainingState } from './training.service.ts'
import { WORKOUT_TEMPLATES, structureFor } from './plan/templates.ts'
import { targetPace, targetHr } from './plan/targets.ts'
import { downgradeOne, adaptiveCombined, adaptiveFromFeedback, localDateStr, fmtShortDate } from './plan/adaptive.ts'
import { buildProgrammeWeek, workoutForRole } from './plan/programme.ts'
import { getWeekMeta } from './plan/weekMeta.ts'
import { archetypeFor, dayRole } from './ai/plan-archetypes.ts'

export { getWeekMeta } from './plan/weekMeta.ts'

// --- data loading -----------------------------------------------------------
// Moved from services/context.service.ts: this is the data step of the plan
// pipeline, not a module of its own. The athlete row comes from the resolved
// session, so a plan read costs no second Athlete query.

/** Throws 503 when Mongo is unreachable — every plan read needs it. */
function requireDB() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('Database not connected — check MONGODB_URI')
  }
}

async function getRecentFeedbacks(athleteId, days = 7) {
  if (!athleteId) return []
  try {
    const since = new Date(Date.now() - days * 86400000)
    return await WorkoutFeedback.find({ athlete: athleteId, date: { $gte: since } })
      .sort({ date: -1 })
      .lean()
  } catch { return [] }
  // ponytail: implicit skip (preferred slot + no activity/feedback after 24h) not yet inferred here — explicit Feedback wins (Q1C/Q6A); add when silent skips need auto-detection
}

export interface TrainingData {
  athlete: any
  athleteId: string
  goal: any
  activities: any[]
  feedbacks: any[]
  zones: any
}

/**
 * The athlete's training inputs, loaded once. Returns null when the session
 * carries no athlete identity (the caller answers 401).
 *
 * `includeActivities: false` is an opt-out, so a goal-only read does not pay for
 * a full scan of the account's activities.
 */
export async function loadTrainingData(
  session,
  { includeActivities = true, includeFeedbacks = false, feedbackDays = 7, includeZones = false } = {}
): Promise<TrainingData | null> {
  const athleteId = session?.athleteId
  if (!athleteId) return null
  requireDB()
  const activities = includeActivities
    ? await Activity.find({ athlete: athleteId }).select('-raw').lean()
    : []
  // The session already loaded this row with exactly this projection.
  const athlete = session.athlete ?? await Athlete.findById(athleteId).select('-access_token -refresh_token').lean()
  // Default 7d keeps the deterministic engine's behaviour unchanged. The AI
  // layer widens this — an athlete logging "my shins hurt" on last Tuesday's run
  // expects that to still matter while planning the coming week.
  const feedbacks = includeFeedbacks ? await getRecentFeedbacks(athlete?._id, feedbackDays) : []
  return {
    athlete,
    athleteId,
    goal: athlete?.goal || null,
    activities,
    feedbacks,
    zones: includeZones ? athlete?.zones || null : null,
  }
}

/** Whole weeks until the goal race, or null when no date is set. */
function weeksOut(goalDate, today = new Date()) {
  if (!goalDate) return null
  const d = new Date(goalDate)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - new Date(today).getTime()) / 86400000 / 7)
}

export interface WeekPlan {
  week: any[]
  weekMeta: { currentWeek: number; totalWeeks: number }
  goal: any
  programme: any
  /** Canonical athlete id the week belongs to. */
  athleteId: string
  /** The deterministic inputs the week was derived from — the AI layer reads these. */
  state: any
  activities: any[]
  feedbacks: any[]
}

/**
 * The Week, its metadata and the programme it belongs to. Null when the session
 * carries no athlete identity.
 */
export async function planWeek(
  session,
  { today = new Date(), feedbackDays = 7 } = {}
): Promise<WeekPlan | null> {
  const data = await loadTrainingData(session, { includeFeedbacks: true, feedbackDays })
  if (!data) return null
  const { activities, goal, feedbacks, athlete } = data
  const state = calcTrainingState(activities)
  const week = buildWeekPlan(state, goal, today, feedbacks, activities)
  // programmeRole is deterministic — it belongs with the plan, not the AI
  // response, so the label renders even when AI is disabled or degraded.
  const archetype = archetypeFor(goal?.goal_type)
  const out = weeksOut(goal?.goal_date, today)
  for (const day of week) {
    day.programmeRole = day.workout.type === 'rest' ? null : dayRole(archetype, out, day.workout.type)
  }
  return {
    week,
    goal,
    weekMeta: getWeekMeta(activities, goal, athlete, today),
    programme: (week as any).programme,
    athleteId: data.athleteId,
    state,
    activities,
    feedbacks,
  }
}

/**
 * The Next Workout for today. Null when the session carries no athlete identity.
 *
 * Reads the same adapted week as `planWeek` and then derives today's detail from
 * it, so `originalType` is threaded through in one place instead of the route
 * having to remember that `buildWeekPlan` already adapted the slot.
 */
export async function planToday(session, { today = new Date() } = {}) {
  const data = await loadTrainingData(session, { includeFeedbacks: true, includeZones: true })
  if (!data) return null
  const { activities, goal, zones, feedbacks } = data
  const state = calcTrainingState(activities)
  const week = buildWeekPlan(state, goal, today, feedbacks, activities)
  const todayEntry = week.find(w => w.isToday)
  if (!todayEntry || todayEntry.workout.type === 'rest') {
    return {
      isRest: true,
      date: todayEntry?.date,
      workout: todayEntry?.workout || { type: 'rest', label: 'REST' },
      training_state: {
        weekly_distance_km: state.weekly.distance7,
        runs_last_7_days: state.weekly.runs7,
      },
    }
  }
  // originalType, not the adapted type: the week already downgraded this slot
  // and adapting twice would drop two steps for one signal.
  const baseType = todayEntry.workout.originalType || todayEntry.workout.type
  const detail = buildRecommendationForType(state, goal, zones, baseType, feedbacks, activities)
  return { ...detail, date: todayEntry.date, workout: todayEntry.workout }
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
  // Week aligned Mon–Sun containing startDate (Figma 9:533 shows MON…SUN with today highlighted)
  // ponytail: localDateStr not toISOString — UTC would shift isToday by 1 at midnight in +/- TZ
  const todayStr = localDateStr(startDate)
  const dow = new Date(startDate).getDay() // 0 Sun (local)
  const diffToMon = dow === 0 ? -6 : 1 - dow
  const monday = new Date(startDate)
  monday.setDate(startDate.getDate() + diffToMon)
  // Programme-driven assignment: the shape of the athlete's distance programme
  // decides how many easy / quality / long days there are and what this week's
  // long run is, capped by what they have actually run (plan/programme.ts).
  // The adaptive passes below still get the final word on their real state.
  const programme = buildProgrammeWeek(trainingState, goal, monday)
  const week = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = localDateStr(d)
    const isToday = dateStr === todayStr
    const dayName = days[i]
    const role = programme.roles[i]
    const built = role === 'rest' ? null : workoutForRole(role, programme, i)
    // Distance stays a number. The old `"6 KM"` display string forced the AI
    // layer to regex it back out and the client to strip the unit again; the
    // unit is now the renderer's business.
    const workout = built
      ? { type: built.type, label: built.label, distance_km: built.distance_km, status: isToday ? 'today' : 'planned' }
      : { type: 'rest', label: 'REST', distance_km: null, status: 'planned' }
    week.push({ day: dayName, date: dateStr, workout, isToday, role })
  }
  // adaptive: next workout only (Q8A) — swap isToday slot based on 7d Feel Window + last-activity deviation
  const todayEntry = week.find(w => w.isToday)
  if (todayEntry && todayEntry.workout.type !== 'rest') {
    const adapted = adaptiveCombined(feedbacks, activities, todayEntry.workout.type)
    if (adapted) {
      if (adapted.type === 'rest') {
        todayEntry.workout = { type: 'rest', label: 'REST', distance_km: null, status: 'adapted', originalType: todayEntry.workout.type, reason: adapted.reason }
      } else if (adapted.type !== todayEntry.workout.type) {
        const tpl = { ...WORKOUT_TEMPLATES[adapted.type] }
        todayEntry.workout = { type: adapted.type, label: adapted.type.toUpperCase(), distance_km: tpl.distance_km, status: 'adapted', originalType: todayEntry.workout.type, reason: adapted.reason }
      }
    }
  }
  // week reorder on skip — ease the next hard sessions after a skipped preferred slot, but keep them on preferred days
  // e.g. skipped recovery today → tempo tomorrow becomes recovery/easy instead of hard
  {
    const now = Date.now()
    const sevenAgo = now - 7 * 86400000
    const recentSkipped = [...(feedbacks || [])]
      .filter(f => f.status === 'skipped' && (() => { const t = new Date(f.date).getTime(); return !isNaN(t) && t >= sevenAgo && t <= now })())
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    if (recentSkipped) {
      const skippedDateStr = fmtShortDate(recentSkipped.date)
      let futurePos = 0
      const isPlainSkip = recentSkipped.rpe == null
      for (const entry of week) {
        if (entry.workout.type === 'rest') continue
        if (entry.isToday) continue
        if (entry.date <= skippedDateStr) continue
        futurePos += 1
        if (isPlainSkip) {
          // plain skip: every remaining preferred slot this week becomes recovery 4km (so Sunday also 4km)
          if (entry.workout.type !== 'recovery') {
            const tpl = { ...WORKOUT_TEMPLATES.recovery }
            entry.workout = { type: 'recovery', label: 'RECOVERY', distance_km: tpl.distance_km, status: 'adapted', originalType: entry.workout.type, reason: `Recovery after skipped workout on ${skippedDateStr}` }
          }
        } else if (futurePos === 1) {
          // high-RPE skip: immediate next slot respects RPE
          const adapted = adaptiveFromFeedback([recentSkipped], entry.workout.type)
          let target = adapted?.type || null
          if (!target) target = 'recovery'
          else if (target === 'easy') target = 'recovery'
          if (target && target !== entry.workout.type) {
            const reason = adapted?.reason || `Recovery after skipped workout on ${skippedDateStr}`
            if (target === 'rest') entry.workout = { type: 'rest', label: 'REST', distance_km: null, status: 'adapted', originalType: entry.workout.type, reason }
            else { const tpl = { ...WORKOUT_TEMPLATES[target] }; entry.workout = { type: target, label: target.toUpperCase(), distance_km: tpl.distance_km, status: 'adapted', originalType: entry.workout.type, reason } }
          }
        } else if (futurePos === 2) {
          // second slot after high-RPE skip: soften one step
          if (['tempo', 'threshold', 'interval', 'steady', 'long'].includes(entry.workout.type)) {
            const down = downgradeOne(entry.workout.type)
            if (down !== entry.workout.type) {
              const tpl = { ...WORKOUT_TEMPLATES[down] }
              entry.workout = { type: down, label: down.toUpperCase(), distance_km: tpl.distance_km, status: 'adapted', originalType: entry.workout.type, reason: `Eased after skipped workout on ${skippedDateStr}` }
            }
          }
        } else break
      }
    }
  }
  // mark the skipped day itself so This Week's Schedule doesn't still show a planned workout
  for (const entry of week) {
    const hit = feedbacks.find(f => f.status === 'skipped' && fmtShortDate(f.date) === entry.date)
    if (hit && entry.workout.type !== 'rest') {
      // keep workout but flag as skipped — UI can dim; don't override an already-adapted today slot
      if (!entry.isToday || entry.workout.status === 'planned') {
        entry.workout = { ...entry.workout, status: 'skipped', originalType: entry.workout.originalType || entry.workout.type, reason: `Skipped on ${entry.date}` }
      }
    }
  }
  week.programme = {
    phase: programme.phase,
    weeks_out: programme.weeksOut,
    cutback: programme.cutback,
    taper: programme.taper,
    long_run_km: programme.longRunKm,
    long_run_target_km: programme.longRunTargetKm,
    notes: programme.notes,
  }
  return week
}

/**
 * Build a weekly plan with optional OpenRouter AI enhancement.
 *
 * After generating the deterministic plan, this function optionally calls
 * OpenRouter to provide seven concise explanations (one per Mon–Sun) and
 * up to three optional workout-type suggestions that respect the
 * established decision hierarchy (safety > goal > consistency > volume >
 * intensity > specificity > performance).
 *
 * When AI is disabled, unavailable, or returns invalid output, the purely
 * deterministic plan is returned unchanged.
 *
 * @param {Object} trainingState - Training state from calcTrainingState()
 * @param {Object} goal - Athlete goal from the Athlete model
 * @param {Date} startDate - Week start date
 * @param {Array} feedbacks - Recent workout feedback entries
 * @param {Array} activities - Recent normalized Strava activities
 * @param {boolean} [aiEnabled] - Whether AI enhancement is enabled
 * @returns {Array} The weekly plan; AI fields present only when AI succeeded
 */
function buildWeekPlanWithAI(trainingState, goal, startDate, feedbacks, activities, aiEnabled) {
  // 1. Deterministic plan (authoritative)
  var deterministicWeek = buildWeekPlan(trainingState, goal, startDate, feedbacks, activities)

  // 2. If AI not enabled (env var OPENROUTER_ENABLED=false or no API key), return deterministic plan
  if (aiEnabled === false || aiEnabled === undefined || aiEnabled === null) {
    return deterministicWeek.map(function (entry) {
      return {
        day: entry.day,
        date: entry.date,
        workout: {
          type: entry.workout.type,
          label: entry.workout.label,
          distance: entry.workout.distance,
          status: entry.workout.status,
          aiExplanation: undefined,
          aiSuggestedType: undefined,
          aiSuggestionReason: undefined,
        },
        isToday: entry.isToday,
      }
    })
  }

  // AI is enabled but actual API call handled at controller level.
  // Return deterministic plan with indicator that AI enhancement is pending.
  return deterministicWeek.map(function (entry) {
    return {
      day: entry.day,
      date: entry.date,
      workout: {
        type: entry.workout.type,
        label: entry.workout.label,
        distance: entry.workout.distance,
        status: entry.workout.status,
        aiExplanation: 'AI enhancement pending — set OPENROUTER_ENABLED=true and OPENROUTER_API_KEY to enable',
        aiSuggestedType: undefined,
        aiSuggestionReason: undefined,
      },
      isToday: entry.isToday,
    }})
}
export { buildWeekPlanWithAI }
