import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuthForUserData } from '../middleware/auth.ts'
import { getSession } from '../services/session.service.ts'
import { planWeek, planToday } from '../services/plan.service.ts'
import { trainingAI, aiStatus, buildAiWeekPayload } from '../services/training-ai.service.ts'
import { clientIpKey } from '../utils/clientIpKey.ts'
import { feedbackSchema } from '../schemas/feedback.ts'
import { zodDetails } from '../schemas/respond.ts'
import { Athlete } from '../models/Athlete.ts'
import { WorkoutFeedback } from '../models/WorkoutFeedback.ts'

const router = Router()

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
    const today = await planToday(await getSession(req))
    if (!today) return res.status(401).json({ error: 'Not authenticated' })
    return res.json(today)
  } catch (e) { next(e) }
})

router.get('/week', requireAuthForUserData, async (req, res, next) => {
  try {
    const plan = await planWeek(await getSession(req))
    if (!plan) return res.status(401).json({ error: 'Not authenticated' })
    const { week, weekMeta, goal, programme } = plan
    return res.json({ week, goal, weekMeta, programme })
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
    const plan = await planWeek(await getSession(req), { feedbackDays: 14 })
    if (!plan) return res.status(401).json({ error: 'Not authenticated' })

    const result = await trainingAI({
      athleteId: plan.athleteId,
      state: plan.state,
      goal: plan.goal,
      week: plan.week,
      feedbacks: plan.feedbacks,
      activities: plan.activities,
      weekKey: plan.week[0]?.date ?? new Date().toISOString().slice(0, 10),
    })

    // The AI layer owns this body, including what a degraded week looks like.
    return res.json(buildAiWeekPayload(plan.week, result))
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
