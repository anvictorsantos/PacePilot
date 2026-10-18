import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuthForUserData } from '../middleware/auth.ts'
import { getSession } from '../services/session.service.ts'
import { loadTrainingData } from '../services/plan.service.ts'
import { goalSchema } from '../schemas/goal.ts'
import { zodDetails } from '../schemas/respond.ts'
import { Athlete } from '../models/Athlete.ts'

const router = Router()

// Goal writes reset goalSetAt (Week 1 anchor) — cap churn.
const goalWriteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: 'draft-7', legacyHeaders: false })

router.get('/', requireAuthForUserData, async (req, res, next) => {
  try {
    // No activities needed for a goal read.
    const data = await loadTrainingData(await getSession(req), { includeActivities: false })
    if (!data) return res.status(401).json({ error: 'Not authenticated' })
    res.json(data.goal)
  } catch (e) { next(e) }
})

router.put('/', requireAuthForUserData, goalWriteLimiter, async (req, res, next) => {
  try {
    const parsed = goalSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid goal', details: zodDetails(parsed.error) })
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findByIdAndUpdate(athleteId, { goal: parsed.data, goalSetAt: new Date() }, { new: true, upsert: false }).select('goal')
    if (!athlete) return res.status(404).json({ error: 'No athlete' })
    res.json(athlete.goal)
  } catch (e) { next(e) }
})

export default router
