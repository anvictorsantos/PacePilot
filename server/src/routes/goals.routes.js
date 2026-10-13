import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.js'
import { getRequestContext } from '../services/context.service.js'
import { goalSchema } from '../schemas/goal.js'
import { zodDetails } from '../schemas/respond.js'
import { Athlete } from '../models/Athlete.js'

const router = Router()

// Goal writes reset goalSetAt (Week 1 anchor) — cap churn.
const goalWriteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: 'draft-7', legacyHeaders: false })

router.get('/', requireAuthForUserData, async (req, res, next) => {
  try {
    const ctx = await getRequestContext(req)
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    res.json(ctx.goal)
  } catch (e) { next(e) }
})

router.put('/', requireAuthForUserData, goalWriteLimiter, async (req, res, next) => {
  try {
    const parsed = goalSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid goal', details: zodDetails(parsed.error) })
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findByIdAndUpdate(athleteId, { goal: parsed.data, goalSetAt: new Date() }, { new: true, upsert: false }).select('goal')
    if (!athlete) return res.status(404).json({ error: 'No athlete' })
    res.json(athlete.goal)
  } catch (e) { next(e) }
})

export default router
