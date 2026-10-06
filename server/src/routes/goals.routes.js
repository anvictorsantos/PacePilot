import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.js'
import { getDemoGoal } from '../services/demo.service.js'
import mongoose from 'mongoose'

const router = Router()

// Goal writes reset goalSetAt (Week 1 anchor) — cap churn.
const goalWriteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: 'draft-7', legacyHeaders: false })

// Whitelist shape — unknown keys stripped, never persisted.
const goalSchema = z.object({
  goal_type: z.enum(['general_fitness', '5K', '10K', 'half_marathon', 'marathon', 'distance_completion', 'maintain']).optional(),
  target_time_min: z.number().positive().max(24 * 60).optional(),
  goal_date: z.string().max(30).refine(v => !Number.isNaN(Date.parse(v)), { message: 'goal_date must be a valid date' }).optional(),
  days_per_week: z.number().int().min(1).max(7).optional(),
  preferred_days: z.array(z.string().max(12)).max(7).optional(),
  constraints: z.array(z.string().max(120)).max(20).optional(),
})

router.get('/', requireAuthForUserData, async (req, res, next) => {
  try {
    if (env.demoMode || mongoose.connection.readyState !== 1) return res.json(getDemoGoal())
    const { Athlete } = await import('../models/Athlete.js')
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('goal').lean()
    res.json(athlete?.goal || getDemoGoal())
  } catch (e) { next(e) }
})

router.put('/', requireAuthForUserData, goalWriteLimiter, async (req, res, next) => {
  try {
    const parsed = goalSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid goal', details: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) })
    if (env.demoMode || mongoose.connection.readyState !== 1) {
      return res.json({ ...getDemoGoal(), ...parsed.data })
    }
    const { Athlete } = await import('../models/Athlete.js')
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findByIdAndUpdate(athleteId, { goal: parsed.data, goalSetAt: new Date() }, { new: true, upsert: false }).select('goal')
    if (!athlete) return res.status(404).json({ error: 'No athlete' })
    res.json(athlete.goal)
  } catch (e) { next(e) }
})

export default router
