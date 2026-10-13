import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.js'
import { getDemoActivities, getDemoGoal, getDemoZones } from '../services/demo.service.js'
import { calcTrainingState } from '../services/training.service.js'
import { recommendNextWorkout, buildWeekPlan, buildRecommendationForType, getWeekMeta } from '../services/plan.service.js'
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

router.get('/today', requireAuthForUserData, async (req, res, next) => {
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
      // use originalType so recommendation doesn't double-downgrade an already-adapted week entry
      const baseType = todayEntry.workout.originalType || todayEntry.workout.type
      const detail = buildRecommendationForType(state, goal, zones, baseType, [], acts)
      // demo: surface adaptation if today was swapped to rest/easy in week
      if (todayEntry.workout.status === 'adapted') {
        detail.isRest = todayEntry.workout.type === 'rest'
        detail.workout = todayEntry.workout
      }
      return res.json({ ...detail, date: todayEntry.date, workout: todayEntry.workout })
    }
    // DB path — scoped to token athlete only.
    const { Activity } = await import('../models/Activity.js')
    const { Athlete } = await import('../models/Athlete.js')
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const activities = await Activity.find({ athlete: athleteId }).select('-raw').lean()
    const athlete = await Athlete.findById(athleteId).select('-access_token -refresh_token').lean()
    const g = athlete?.goal || goal
    const zones = athlete?.zones || null
    const state = calcTrainingState(activities)
    const feedbacks = await getRecentFeedbacks(athlete?._id)
    const week = buildWeekPlan(state, g, new Date(), feedbacks, activities)
    const todayEntry = week.find(w => w.isToday)
    if (!todayEntry || todayEntry.workout.type === 'rest') {
      return res.json({ isRest: true, date: todayEntry?.date, workout: todayEntry?.workout || { type: 'rest', label: 'REST' }, training_state: { weekly_distance_km: state.weekly.distance7, runs_last_7_days: state.weekly.runs7 } })
    }
    const baseType2 = todayEntry.workout.originalType || todayEntry.workout.type
    const detail = buildRecommendationForType(state, g, zones, baseType2, feedbacks, activities)
    res.json({ ...detail, date: todayEntry.date, workout: todayEntry.workout })
  } catch (e) { next(e) }
})

router.get('/week', requireAuthForUserData, async (req, res, next) => {
  try {
    const acts = getActivities()
    const goal = getGoal()
    if (acts) {
      const state = calcTrainingState(acts)
      const week = buildWeekPlan(state, goal, new Date(), [], acts)
      return res.json({ week, goal, weekMeta: getWeekMeta(acts, goal, new Date()) })
    }
    const { Activity } = await import('../models/Activity.js')
    const { Athlete } = await import('../models/Athlete.js')
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const activities = await Activity.find({ athlete: athleteId }).select('-raw').lean()
    const athlete = await Athlete.findById(athleteId).select('-access_token -refresh_token').lean()
    const feedbacks = await getRecentFeedbacks(athlete?._id)
    const state = calcTrainingState(activities)
    const g = athlete?.goal || goal
    const week = buildWeekPlan(state, g, new Date(), feedbacks, activities)
    res.json({ week, goal: g, weekMeta: getWeekMeta(activities, g, athlete, new Date()) })
  } catch (e) { next(e) }
})

router.post('/feedback', requireAuthForUserData, async (req, res, next) => {
  try {
    const feedbackSchema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }).refine(v => {
        const [y, m, d] = v.split('-').map(Number)
        const dt = new Date(Date.UTC(y, m - 1, d))
        return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
      }, { message: 'date must be a real calendar date' }),
      rpe: z.coerce.number().int().min(1).max(10).optional().nullable(),
      status: z.enum(['completed', 'skipped', 'modified']).optional().default('completed'),
      note: z.string().max(2000).optional(),
      notes: z.string().max(2000).optional(),
    })
    const parsed = feedbackSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid feedback', details: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) })
    const { date, rpe, note, notes, status } = parsed.data
    const rpeNum = rpe ?? null
    if (env.demoMode || mongoose.connection.readyState !== 1) return res.json({ ok: true, demo: true, date, rpe: rpeNum, status })
    const { Athlete } = await import('../models/Athlete.js')
    const { WorkoutFeedback } = await import('../models/WorkoutFeedback.js')
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('_id')
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

router.get('/feedback', requireAuthForUserData, async (req, res, next) => {
  try {
    if (env.demoMode || mongoose.connection.readyState !== 1) return res.json([])
    const { Athlete } = await import('../models/Athlete.js')
    const { WorkoutFeedback } = await import('../models/WorkoutFeedback.js')
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('_id').lean()
    if (!athlete) return res.json([])
    const items = await WorkoutFeedback.find({ athlete: athlete._id }).sort({ date: -1 }).limit(20).lean()
    res.json(items)
  } catch (e) { next(e) }
})

export default router
