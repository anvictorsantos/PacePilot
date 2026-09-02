import { Router } from 'express'
import { env } from '../config/env.js'
import { getDemoGoal } from '../services/demo.service.js'
import mongoose from 'mongoose'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    if (env.demoMode || mongoose.connection.readyState !== 1) return res.json(getDemoGoal())
    const { Athlete } = await import('../models/Athlete.js')
    const athlete = await Athlete.findOne().lean()
    res.json(athlete?.goal || getDemoGoal())
  } catch (e) { next(e) }
})

router.put('/', async (req, res, next) => {
  try {
    if (env.demoMode || mongoose.connection.readyState !== 1) {
      return res.json({ ...getDemoGoal(), ...req.body })
    }
    const { Athlete } = await import('../models/Athlete.js')
    const athlete = await Athlete.findOneAndUpdate({}, { goal: req.body }, { new: true, upsert: true })
    res.json(athlete.goal)
  } catch (e) { next(e) }
})

export default router
