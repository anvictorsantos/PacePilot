import { Router } from 'express'
import { env } from '../config/env.js'
import { getDemoActivities, getDemoGoal, getDemoZones } from '../services/demo.service.js'
import { calcTrainingState } from '../services/training.service.js'
import { recommendNextWorkout, buildWeekPlan, buildRecommendationForType } from '../services/plan.service.js'
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

async function getRecentFeedbacks(athleteId) {
  if (!athleteId || env.demoMode || mongoose.connection.readyState !== 1) return []
  try {
    const { WorkoutFeedback } = await import('../models/WorkoutFeedback.js')
    const since = new Date(Date.now() - 7 * 86400000)
    const items = await WorkoutFeedback.find({ athlete: athleteId, date: { $gte: since } }).sort({ date: -1 }).lean()
    return items
  } catch { return [] }
  // ponytail: implicit skip (preferred slot + no activity/feedback after 24h) not yet inferred here — explicit Feedback wins (Q1C/Q6A); add when silent skips need auto-detection
}

router.get('/today', async (req, res, next) => {
  try {
    const acts = getActivities()
    const goal = getGoal()
    if (acts) {
      const state = calcTrainingState(acts)
      const zones = getDemoZones()
      const week = buildWeekPlan(state, goal, new Date(), [], acts)
      const todayEntry = week.find(w => w.isToday)
      if (!todayEntry || todayEntry.workout.type === 'rest') {
        return res.json({ isRest: true, date: todayEntry?.date, workout: todayEntry?.workout || { type: 'rest', label: 'REST' }, training_state: { weekly_distance_km: state.weekly.distance7, runs_last_7_days: state.weekly.runs7 } })
      }
      const detail = buildRecommendationForType(state, goal, zones, todayEntry.workout.type, [], acts)
      // demo: surface adaptation if today was swapped to rest/easy in week
      if (todayEntry.workout.status === 'adapted') {
        detail.isRest = todayEntry.workout.type === 'rest'
        detail.workout = todayEntry.workout
      }
      return res.json({ ...detail, date: todayEntry.date, workout: todayEntry.workout })
    }
    // DB path
    const { Activity } = await import('../models/Activity.js')
    const { Athlete } = await import('../models/Athlete.js')
    const activities = await Activity.find().lean()
    const athlete = await Athlete.findOne().lean()
    const g = athlete?.goal || goal
    const zones = athlete?.zones || null
    const state = calcTrainingState(activities)
    const feedbacks = await getRecentFeedbacks(athlete?._id)
    const week = buildWeekPlan(state, g, new Date(), feedbacks, activities)
    const todayEntry = week.find(w => w.isToday)
    if (!todayEntry || todayEntry.workout.type === 'rest') {
      return res.json({ isRest: true, date: todayEntry?.date, workout: todayEntry?.workout || { type: 'rest', label: 'REST' }, training_state: { weekly_distance_km: state.weekly.distance7, runs_last_7_days: state.weekly.runs7 } })
    }
    const detail = buildRecommendationForType(state, g, zones, todayEntry.workout.type, feedbacks, activities)
    res.json({ ...detail, date: todayEntry.date, workout: todayEntry.workout })
  } catch (e) { next(e) }
})

router.get('/week', async (req, res, next) => {
  try {
    const acts = getActivities()
    const goal = getGoal()
    if (acts) {
      const state = calcTrainingState(acts)
      return res.json({ week: buildWeekPlan(state, goal, new Date(), [], acts), goal })
    }
    const { Activity } = await import('../models/Activity.js')
    const { Athlete } = await import('../models/Athlete.js')
    const activities = await Activity.find().lean()
    const athlete = await Athlete.findOne().lean()
    const feedbacks = await getRecentFeedbacks(athlete?._id)
    const state = calcTrainingState(activities)
    res.json({ week: buildWeekPlan(state, athlete?.goal || goal, new Date(), feedbacks, activities), goal: athlete?.goal || goal })
  } catch (e) { next(e) }
})

router.post('/feedback', async (req, res, next) => {
  try {
    const { date, rpe, note, notes, status } = req.body || {}
    if (!date) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' })
    const rpeNum = rpe != null ? Number(rpe) : null
    if (rpeNum != null && (rpeNum < 1 || rpeNum > 10)) return res.status(400).json({ error: 'rpe must be 1–10' })
    if (env.demoMode || mongoose.connection.readyState !== 1) return res.json({ ok: true, demo: true, date, rpe: rpeNum, status: status || 'completed' })
    const { Athlete } = await import('../models/Athlete.js')
    const { WorkoutFeedback } = await import('../models/WorkoutFeedback.js')
    const athlete = await Athlete.findOne()
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

router.get('/feedback', async (req, res, next) => {
  try {
    if (env.demoMode || mongoose.connection.readyState !== 1) return res.json([])
    const { Athlete } = await import('../models/Athlete.js')
    const { WorkoutFeedback } = await import('../models/WorkoutFeedback.js')
    const athlete = await Athlete.findOne().lean()
    if (!athlete) return res.json([])
    const items = await WorkoutFeedback.find({ athlete: athlete._id }).sort({ date: -1 }).limit(20).lean()
    res.json(items)
  } catch (e) { next(e) }
})

export default router
