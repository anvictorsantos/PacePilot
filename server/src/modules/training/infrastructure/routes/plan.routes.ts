import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuthForUserData } from '@/modules/shared/infrastructure/http/auth.ts'
import { getSession, type AthleteSession } from '@/modules/athlete/application/session.service.ts'
import { planWeek, planToday, currentWeekKey } from '@/modules/training/application/plan.service.ts'
import { trainingAI, aiStatus, aiModel, buildAiWeekPayload } from '@/modules/ai/application/training-ai.service.ts'
import { aiCacheKey, cacheGet, cacheSet, clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'
import { clientIpKey } from '@/modules/shared/infrastructure/utils/clientIpKey.ts'
import { feedbackSchema } from '@/modules/training/infrastructure/schemas/feedback.ts'
import { parseAiLocale } from '@/modules/training/infrastructure/schemas/ai-locale.ts'
import { zodDetails } from '@/modules/shared/infrastructure/schemas/respond.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { WorkoutFeedback } from '@/modules/training/infrastructure/persistence/WorkoutFeedback.ts'

const router = Router()

// getSession caches the resolved session on the request itself (session.service.ts).
// express-session is not in use, so `session` is not part of the base Request type.
type RequestWithSession = Request & { session?: AthleteSession }

// AI calls are quota-bound (free tier: 50 req/day per OpenRouter account, shared
// by every athlete). Tighter than writeLimiter and keyed per athlete where we
// can identify one, so one client cannot drain the account's daily allowance.
// Cache hits are answered by aiWeekCacheHit before this middleware, so the
// allowance counts generations, not page reloads.
// Memory store resets per serverless instance — approximate, not strict.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as RequestWithSession).session?.athleteId || clientIpKey(req),
})

router.get('/today', requireAuthForUserData, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = await planToday(await getSession(req))
    if (!today) return res.status(401).json({ error: 'Not authenticated' })
    return res.json(today)
  } catch (e) { next(e) }
})

router.get('/week', requireAuthForUserData, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await planWeek(await getSession(req))
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
    const d = new Date(date)
    const doc = await WorkoutFeedback.findOneAndUpdate(
      { athlete: athlete._id, date: d },
      { athlete: athlete._id, date: d, rpe: rpeNum, notes: note ?? notes ?? '', status: status || 'completed' },
      { upsert: true, new: true }
    )
    // The note and RPE are prompt inputs, so a cached week no longer describes
    // this athlete. Without this the athlete writes "perna pesada" and the coach
    // captions ignore it until the TTL expires (6h by default).
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

/**
 * A cached week is answered here, before the quota limiter. Reloading the plan
 * is not a provider call and must not spend the 20/h allowance; the limiter is
 * there for generations. Everything needed for the key is already on the
 * request: the session is resolved by `requireAuthForUserData`, and the week is
 * Monday of the current week, not a value read from the plan.
 */
export async function aiWeekCacheHit(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req) // cached on the request by auth middleware
    if (!session.athleteId) return next() // the handler owns the 401
    const key = aiCacheKey({
      athleteId: session.athleteId,
      weekKey: currentWeekKey(),
      locale: parseAiLocale(req.query.locale),
      model: aiModel,
    })
    const cached = cacheGet(key)
    if (cached) return res.json(cached)
    res.locals.aiWeekKey = key
    next()
  } catch (e) { next(e) }
}

/**
 * AI enhancement for the deterministic week. Deliberately separate from
 * /week so the plan renders instantly without spending quota, and so AI has its
 * own limiter and its own failure mode. The schedule is never modified here:
 * response carries only AI-authored fields the client layers on top.
 */
router.get('/ai/week', requireAuthForUserData, aiWeekCacheHit, aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 14d feedback window (deterministic routes keep the 7d default): a comment
    // written about last Tuesday's run should still shape this week's coaching.
    const plan = await planWeek(await getSession(req), { feedbackDays: 14 })
    if (!plan) return res.status(401).json({ error: 'Not authenticated' })

    const locale = parseAiLocale(req.query.locale)
    const weekKey = currentWeekKey()
    const result = await trainingAI({
      athleteId: plan.athleteId,
      state: plan.state,
      goal: plan.goal,
      week: plan.week,
      feedbacks: plan.feedbacks,
      activities: plan.activities,
      weekKey,
      locale,
    })

    // The AI layer owns this body, including what a degraded week looks like.
    const payload = buildAiWeekPayload(plan.week, result)
    // Degraded and failed generations are never cached: quota errors and outages
    // are transient, and caching one bad minute would extend it to hours.
    if (result.success) {
      const key = (res.locals.aiWeekKey as string | undefined)
        ?? aiCacheKey({ athleteId: plan.athleteId, weekKey, locale, model: aiModel })
      cacheSet(key, payload)
    }
    return res.json(payload)
  } catch (e) { next(e) }
})

/**
 * Free-tier health. Reports whether the configured model is still in the free
 * catalog (a stale id is the usual cause of silent AI failure) without exposing
 * the API key. GET /models is free and not quota-bound.
 */
router.get('/ai/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await aiStatus())
  } catch (e) { next(e) }
})

export default router
