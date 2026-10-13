import { Router } from 'express'
import { z } from 'zod'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.js'
import { calcTrainingState } from '../services/training.service.js'
import { buildWeekPlan, buildRecommendationForType, getWeekMeta } from '../services/plan.service.js'
import { getRequestContext } from '../services/context.service.js'
import { Athlete } from '../models/Athlete.js'
import { WorkoutFeedback } from '../models/WorkoutFeedback.js'

const router = Router()

router.get('/today', requireAuthForUserData, async (req, res, next) => {
  try {
    const ctx = await getRequestContext(req, { includeFeedbacks: true, includeZones: true })
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    const { activities, goal, zones, feedbacks } = ctx
    const state = calcTrainingState(activities)
    const week = buildWeekPlan(state, goal, new Date(), feedbacks, activities)
    const todayEntry = week.find(w => w.isToday)
    if (!todayEntry || todayEntry.workout.type === 'rest') {
      return res.json({ isRest: true, date: todayEntry?.date, workout: todayEntry?.workout || { type: 'rest', label: 'REST' }, training_state: { weekly_distance_km: state.weekly.distance7, runs_last_7_days: state.weekly.runs7 } })
    }
    // use originalType so recommendation doesn't double-downgrade an already-adapted week entry
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
    const week = buildWeekPlan(state, goal, new Date(), feedbacks, activities)
    return res.json({ week, goal, weekMeta: getWeekMeta(activities, goal, athlete, new Date()) })
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
