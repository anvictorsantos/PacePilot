import { Router } from 'express'
import { env } from '../config/env.js'
import { getDemoActivities, getDemoGoal } from '../services/demo.service.js'
import { calcTrainingState } from '../services/training.service.js'
import { recommendNextWorkout, buildWeekPlan } from '../services/plan.service.js'
import mongoose from 'mongoose'

const router = Router()

function getActivities() {
  if (env.demoMode || mongoose.connection.readyState !== 1) return getDemoActivities()
  return null // would query Activity collection
}
function getGoal() {
  if (env.demoMode || mongoose.connection.readyState !== 1) return getDemoGoal()
  return null
}

router.get('/today', async (req, res, next) => {
  try {
    const acts = getActivities()
    const goal = getGoal()
    if (acts) {
      const state = calcTrainingState(acts)
      const rec = recommendNextWorkout(state, goal)
      return res.json(rec)
    }
    // DB path
    const { Activity } = await import('../models/Activity.js')
    const { Athlete } = await import('../models/Athlete.js')
    const activities = await Activity.find().lean()
    const athlete = await Athlete.findOne().lean()
    const state = calcTrainingState(activities)
    res.json(recommendNextWorkout(state, athlete?.goal || goal))
  } catch (e) { next(e) }
})

router.get('/week', async (req, res, next) => {
  try {
    const acts = getActivities()
    const goal = getGoal()
    if (acts) {
      const state = calcTrainingState(acts)
      return res.json({ week: buildWeekPlan(state, goal), goal })
    }
    const { Activity } = await import('../models/Activity.js')
    const { Athlete } = await import('../models/Athlete.js')
    const activities = await Activity.find().lean()
    const athlete = await Athlete.findOne().lean()
    const state = calcTrainingState(activities)
    res.json({ week: buildWeekPlan(state, athlete?.goal || goal), goal: athlete?.goal || goal })
  } catch (e) { next(e) }
})

export default router
