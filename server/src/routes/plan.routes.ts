import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuthForUserData } from '../middleware/auth.ts'
import { getSession } from '../services/session.service.ts'
import { calcTrainingState } from '../services/training.service.ts'
import { buildWeekPlan, buildRecommendationForType, getWeekMeta } from '../services/plan.service.ts'
import { getRequestContext } from '../services/context.service.ts'
import { trainingAI, aiStatus } from '../services/training-ai.service.ts'
import { archetypeFor, dayRole } from '../services/ai/plan-archetypes.ts'
import { clientIpKey } from '../utils/clientIpKey.ts'
import { feedbackSchema } from '../schemas/feedback.ts'
import { zodDetails } from '../schemas/respond.ts'
import { Athlete } from '../models/Athlete.ts'
import { WorkoutFeedback } from '../models/WorkoutFeedback.ts'

const router = Router()

/** Whole weeks until the goal race, or null when no date is set. */
function goalDaysOut(goalDate) {
  if (!goalDate) return null
  const d = new Date(goalDate)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000 / 7)
}

// AI calls are quota-bound (free tier: 50 req/day per OpenRouter account, shared
// by every athlete). Tighter than writeLimiter and keyed per athlete where we
// can identify one, so one client cannot drain the account's daily allowance.
// Memory store resets per serverless instance — approximate, not strict.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.session?.athleteId || clientIpKey(req),
})

router.get('/today', requireAuthForUserData, async (req, res, next) => {
  try {
    const ctx = await getRequestContext(req, { includeFeedbacks: true, includeZones: true })
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    const { activities, goal, zones, feedbacks } = ctx
    const state = calcTrainingState(activities)
    // Deterministic only. AI copy arrives separately from /ai/week so the plan
    // renders without spending provider quota.
    const week = buildWeekPlan(state, goal, new Date(), feedbacks, activities)
    const todayEntry = week.find(w => w.isToday)
    if (!todayEntry || todayEntry.workout.type === 'rest') {
      return res.json({ isRest: true, date: todayEntry?.date, workout: todayEntry?.workout || { type: 'rest', label: 'REST' }, training_state: { weekly_distance_km: state.weekly.distance7, runs_last_7_days: state.weekly.runs7 } })
    }
    // use originalType so recommendation doesn't double-downgrade a slot that
    // buildWeekPlan already adapted.
    const baseType = todayEntry.workout.originalType || todayEntry.workout.type
    const detail = buildRecommendationForType(state, goal, zones, baseType, feedbacks, activities)
    return res.json({ ...detail, date: todayEntry.date, workout: todayEntry.workout })
  } catch (e) { next(e) }
})

router.get('/week', requireAuthForUserData, async (req, res, next) => {
  try {
    const ctx = await getRequestContext(req, { includeFeedbacks: true })
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    const { activities, goal, feedbacks, athlete } = ctx
    const state = calcTrainingState(activities)
    const week = buildWeekPlan(state, goal, new Date(), feedbacks, activities)
    // programmeRole is deterministic — it belongs with the plan, not the AI
    // response, so the label renders even when AI is disabled or degraded.
    const archetype = archetypeFor(goal?.goal_type)
    const daysOut = goalDaysOut(goal?.goal_date)
    for (const day of week) {
      day.programmeRole = day.workout.type === 'rest'
        ? null
        : dayRole(archetype, daysOut, day.workout.type)
    }
    return res.json({
      week,
      goal,
      weekMeta: getWeekMeta(activities, goal, athlete, new Date()),
      programme: week.programme,
    })
  } catch (e) { next(e) }
})

router.post('/feedback', requireAuthForUserData, async (req, res, next) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid feedback', details: zodDetails(parsed.error) })
    const { date, rpe, note, notes, status } = parsed.data
    const rpeNum = rpe ?? null
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('_id')
    if (!athlete) return res.status(404).json({ error: 'No athlete' })
    const d = new Date(date)
    const doc = await WorkoutFeedback.findOneAndUpdate(
      { athlete: athlete._id, date: d },
      { athlete: athlete._id, date: d, rpe: rpeNum, notes: note ?? notes ?? '', status: status || 'completed' },
      { upsert: true, new: true }
    )
    res.json(doc)
  } catch (e) { next(e) }
})

router.get('/feedback', requireAuthForUserData, async (req, res, next) => {
  try {
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('_id').lean()
    if (!athlete) return res.json([])
    const items = await WorkoutFeedback.find({ athlete: athlete._id }).sort({ date: -1 }).limit(20).lean()
    res.json(items)
  } catch (e) { next(e) }
})

/**
 * AI enhancement for the deterministic week. Deliberately separate from
 * /week so the plan renders instantly without spending quota, and so AI has its
 * own limiter and its own failure mode. The schedule is never modified here:
 * response carries only AI-authored fields the client layers on top.
 */
router.get('/ai/week', requireAuthForUserData, aiLimiter, async (req, res, next) => {
  try {
    // 14d feedback window (deterministic routes keep the 7d default): a comment
    // written about last Tuesday's run should still shape this week's coaching.
    const ctx = await getRequestContext(req, { includeFeedbacks: true, feedbackDays: 14 })
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    const athleteId = (await getSession(req)).athleteId
    const { activities, goal, feedbacks } = ctx
    const state = calcTrainingState(activities)
    const week = buildWeekPlan(state, goal, new Date(), feedbacks, activities)

    const result = await trainingAI({
      athleteId,
      state,
      goal,
      week,
      feedbacks,
      activities,
      weekKey: week[0]?.date ?? new Date().toISOString().slice(0, 10),
    })

    // Degradation is reported, not thrown: the client keeps showing the plan.
    if (!result.success) {
      return res.status(200).json({
        week: [],
        suggestions: [],
        enabled: true,
        degraded: result.degraded,
        code: result.code,
      })
    }

    const days = week.map((day, index) => ({
      date: day.date,
      aiExplanation: result.explanations[index] ?? null,
      aiSuggestedType: null,
      aiSuggestionReason: null,
    }))
    for (const s of result.suggestions) {
      days[s.dayIndex].aiSuggestedType = s.suggestedType
      days[s.dayIndex].aiSuggestionReason = s.reason
    }

    return res.json({
      week: days,
      suggestions: result.suggestions,
      model: result.model,
      cached: result.cached,
      confidence: result.confidence,
      degraded: null,
    })
  } catch (e) { next(e) }
})

/**
 * Free-tier health. Reports whether the configured model is still in the free
 * catalog (a stale id is the usual cause of silent AI failure) without exposing
 * the API key. GET /models is free and not quota-bound.
 */
router.get('/ai/status', async (_req, res, next) => {
  try {
    res.json(await aiStatus())
  } catch (e) { next(e) }
})

export default router
