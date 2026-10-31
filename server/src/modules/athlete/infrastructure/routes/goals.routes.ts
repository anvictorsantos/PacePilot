import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuthForUserData } from '@/modules/shared/infrastructure/http/auth.ts'
import { getSession } from '@/modules/athlete/application/session.service.ts'
import { loadTrainingData } from '@/modules/training/application/plan.service.ts'
import { goalSchema } from '@/modules/athlete/infrastructure/schemas/goal.ts'
import { zodDetails } from '@/modules/shared/infrastructure/schemas/respond.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'

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
    // The goal type and date shape the prompt (archetype, weeks out), so the cached
    // coaching copy belongs to the old goal. Drop it before the client re-reads the week.
    clearAiCacheForAthlete(String(athleteId))
    res.json(athlete.goal)
  } catch (e) { next(e) }
})

export default router
