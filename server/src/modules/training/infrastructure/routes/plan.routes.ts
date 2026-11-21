import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuthForUserData } from '@/modules/shared/infrastructure/http/auth.ts'
import { getSession, type AthleteSession } from '@/modules/athlete/application/session.service.ts'
import { planWeek, planToday, currentWeekKey, shapeWeekPlan } from '@/modules/training/application/plan.service.ts'
import { trainingAI, aiStatus, aiModel, buildAiWeekPayload } from '@/modules/ai/application/training-ai.service.ts'
import { aiCacheKey, cacheGet, cacheSet, clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'
import { clientIpKey } from '@/modules/shared/infrastructure/utils/clientIpKey.ts'
import { timeZoneFromHeader } from '@/modules/shared/infrastructure/time/timeZone.ts'
import { feedbackSchema } from '@/modules/training/infrastructure/schemas/feedback.ts'
import { parseAiLocale } from '@/modules/training/infrastructure/schemas/ai-locale.ts'
import { zodDetails } from '@/modules/shared/infrastructure/schemas/respond.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { WorkoutFeedback } from '@/modules/training/infrastructure/persistence/WorkoutFeedback.ts'
import { localDateFromKey } from '@/modules/training/domain/adaptive.ts'

const router = Router()

// getSession caches the resolved session on the request; express-session is not
// in use, so `session` is not part of the base Request type.
type RequestWithSession = Request & { session?: AthleteSession }

// Credit-bound: every cache miss spends OpenCode credits, shared by every athlete.
// Keyed per athlete so one client cannot drain the budget; memory store resets per
// restart.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as RequestWithSession).session?.athleteId || clientIpKey(req),
})

router.get('/today', requireAuthForUserData, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = await planToday(await getSession(req), {
      timeZone: timeZoneFromHeader(req.headers?.['x-timezone']),
    })
    if (!today) return res.status(401).json({ error: 'Not authenticated' })
    return res.json(today)
  } catch (e) { next(e) }
})

router.get('/week', requireAuthForUserData, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await planWeek(await getSession(req), {
      timeZone: timeZoneFromHeader(req.headers?.['x-timezone']),
    })
    if (!plan) return res.status(401).json({ error: 'Not authenticated' })
    const { week, weekMeta, goal, programme, nextWeek } = plan
    return res.json({ week, goal, weekMeta, programme, nextWeek })
  } catch (e) { next(e) }
})

router.post('/feedback', requireAuthForUserData, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid feedback', details: zodDetails(parsed.error) })
    const { date, rpe, note, notes, status } = parsed.data
    const rpeNum = rpe ?? null
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('_id')
    if (!athlete) return res.status(404).json({ error: 'No athlete' })
    const d = localDateFromKey(date)
    const doc = await WorkoutFeedback.findOneAndUpdate(
      { athlete: athlete._id, date: d },
      { athlete: athlete._id, date: d, rpe: rpeNum, notes: note ?? notes ?? '', status: status || 'completed' },
      { upsert: true, new: true }
    )
    // Notes and RPE feed the prompt, so a cached week no longer describes this athlete.
    clearAiCacheForAthlete(String(athlete._id))
    res.json(doc)
  } catch (e) { next(e) }
})

router.get('/feedback', requireAuthForUserData, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('_id').lean()
    if (!athlete) return res.json([])
    const items = await WorkoutFeedback.find({ athlete: athlete._id }).sort({ date: -1 }).limit(20).lean()
    res.json(items)
  } catch (e) { next(e) }
})

// A cache hit answers here, before the quota limiter: reloading the plan is not a
// provider call. The key needs only the session and the current week.
export async function aiWeekCacheHit(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req)
    if (!session.athleteId) return next() // the handler owns the 401
    const key = aiCacheKey({
      athleteId: session.athleteId,
      weekKey: currentWeekKey(new Date(), timeZoneFromHeader(req.headers?.['x-timezone'])),
      locale: parseAiLocale(req.query.locale),
      model: aiModel,
    })
    const cached = cacheGet(key)
    if (cached) return res.json(cached)
    res.locals.aiWeekKey = key
    next()
  } catch (e) { next(e) }
}

// The athlete can turn the explain layer off; an older client would otherwise
// keep spending quota. Answers with the same empty shape a degraded call uses.
export async function aiExplanationsEnabled(req: Request, res: Response, next: NextFunction) {
  try {
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return next() // the handler owns the 401
    const athlete = await Athlete.findById(athleteId)
      .select('preferences.coaching.explanations')
      .lean()
    if (athlete?.preferences?.coaching?.explanations === false) {
      return res.json({ week: [], suggestions: [], enabled: false, disabled: true })
    }
    next()
  } catch (e) {
    next(e)
  }
}

// Separate from /week so the plan renders without spending quota and AI has its
// own limiter. Response carries AI-authored fields only, never the schedule.
router.get('/ai/week', requireAuthForUserData, aiExplanationsEnabled, aiWeekCacheHit, aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 14d feedback window (deterministic routes keep 7d): a comment about last
    // Tuesday's run should still shape this week's coaching.
    const timeZone = timeZoneFromHeader(req.headers?.['x-timezone'])
    const plan = await planWeek(await getSession(req), { feedbackDays: 14, timeZone })
    if (!plan) return res.status(401).json({ error: 'Not authenticated' })

    const locale = parseAiLocale(req.query.locale)
    const weekKey = currentWeekKey(new Date(), timeZone)
    const result = await trainingAI({
      athleteId: plan.athleteId,
      state: plan.state,
      goal: plan.goal,
      week: plan.week,
      programme: {
        phase: plan.week.programmeWeek.phase,
        cutback: plan.week.programmeWeek.cutback,
        taper: plan.week.programmeWeek.taper,
        weeksOut: plan.week.programmeWeek.weeksOut,
        roles: plan.week.programmeWeek.roles,
        qualityTypes: plan.week.programmeWeek.qualityTypes,
        longRunKm: plan.week.programmeWeek.longRunKm,
        easyKm: plan.week.programmeWeek.easyKm,
        notes: plan.week.programmeWeek.notes,
      },
      weekMeta: plan.weekMeta,
      feedbacks: plan.feedbacks,
      activities: plan.activities,
      weekKey,
      locale,
    })

    const payload = buildAiWeekPayload(plan.week, result)
    // The engine re-validates the model's shape and rebuilds deterministically;
    // a rejected proposal leaves the baseline schedule untouched.
    if (result.success && result.shape) {
      const shaped = shapeWeekPlan(plan, result.shape, { timeZone })
      if (shaped) payload.schedule = shaped
    }
    // Degraded and failed generations are not cached: quota errors and outages
    // are transient, and caching one bad minute would extend it to hours.
    if (result.success) {
      const key = (res.locals.aiWeekKey as string | undefined)
        ?? aiCacheKey({ athleteId: plan.athleteId, weekKey, locale, model: aiModel })
      cacheSet(key, payload)
    }
    return res.json(payload)
  } catch (e) { next(e) }
})

// Free-tier health: a stale model id is the usual cause of silent AI failure.
// GET /models is free and not quota-bound, and the API key is never exposed.
// Auth-gated: the configured model and catalogue state are operational detail.
router.get('/ai/status', requireAuthForUserData, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await aiStatus())
  } catch (e) { next(e) }
})

export default router
