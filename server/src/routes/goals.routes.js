import { Router } from 'express'
import { env } from '../config/env.js'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.js'
import { getDemoGoal } from '../services/demo.service.js'
import mongoose from 'mongoose'

const router = Router()

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

router.put('/', requireAuthForUserData, async (req, res, next) => {
  try {
    if (env.demoMode || mongoose.connection.readyState !== 1) {
      return res.json({ ...getDemoGoal(), ...req.body })
    }
    const { Athlete } = await import('../models/Athlete.js')
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findByIdAndUpdate(athleteId, { goal: req.body, goalSetAt: new Date() }, { new: true, upsert: false }).select('goal')
    if (!athlete) return res.status(404).json({ error: 'No athlete' })
    res.json(athlete.goal)
  } catch (e) { next(e) }
})

export default router
