import { Router } from 'express'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.ts'
import { calcTrainingState } from '../services/training.service.ts'
import { buildWeekPlan, buildWeekPlanWithAI, buildRecommendationForType, getWeekMeta } from '../services/plan.service.ts'
import { getRequestContext } from '../services/context.service.ts'
import { feedbackSchema } from '../schemas/feedback.ts'
import { zodDetails } from '../schemas/respond.ts'
import { Athlete } from '../models/Athlete.ts'
import { WorkoutFeedback } from '../models/WorkoutFeedback.ts'

const router = Router()

router.get('/today', requireAuthForUserData, async (req, res, next) => {
  try {
    const ctx = await getRequestContext(req, { includeFeedbacks: true, includeZones: true })
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    const { activities, goal, zones, feedbacks } = ctx
    const state = calcTrainingState(activities)
    const week = buildWeekPlanWithAI(state, goal, new Date(), feedbacks, activities)
    const todayEntry = week.find(w => w.isToday)
    if (!todayEntry || todayEntry.workout.type === 'rest') {
      return res.json({ isRest: true, date: todayEntry?.date, workout: todayEntry?.workout || { type: 'rest', label: 'REST' }, training_state: { weekly_distance_km: state.weekly.distance7, runs_last_7_days: state.weekly.runs7 } })
    }
    // use originalType so recommendation doesn't double-downgrade a slot that
    // buildWeekPlan already adapted.
    const baseType = todayEntry.workout.originalType || todayEntry.workout.type
    const detail = buildRecommendationForType(state, goal, zones, baseType, feedbacks, activities)
    return res.json({ ...detail, date: todayEntry.date, workout: todayEntry.workout })
  } catch (e) { next(e) }
})

router.get('/week', requireAuthForUserData, async (req, res, next) => {
  try {
    const ctx = await getRequestContext(req, { includeFeedbacks: true })
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    const { activities, goal, feedbacks, athlete } = ctx
    const state = calcTrainingState(activities)
    const week = buildWeekPlanWithAI(state, goal, new Date(), feedbacks, activities)
    return res.json({ week, goal, weekMeta: getWeekMeta(activities, goal, athlete, new Date()) })
  } catch (e) { next(e) }
})

router.post('/feedback', requireAuthForUserData, async (req, res, next) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid feedback', details: zodDetails(parsed.error) })
    const { date, rpe, note, notes, status } = parsed.data
    const rpeNum = rpe ?? null
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
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('_id').lean()
    if (!athlete) return res.json([])
    const items = await WorkoutFeedback.find({ athlete: athlete._id }).sort({ date: -1 }).limit(20).lean()
    res.json(items)
  } catch (e) { next(e) }
})

export default router
