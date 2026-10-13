import { Router } from 'express'
import { requireAuthForUserData } from '../middleware/auth.js'
import { calcTrainingState, weeklyVolumeSeries } from '../services/training.service.js'
import { getRequestContext } from '../services/context.service.js'

const router = Router()

router.get('/', requireAuthForUserData, async (req, res, next) => {
  try {
    const ctx = await getRequestContext(req)
    if (ctx.unauthorized) return res.status(401).json({ error: 'Not authenticated' })
    const { activities, goal } = ctx
    const state = calcTrainingState(activities)
    const volumeSeries = weeklyVolumeSeries(activities, 8)
    // pace trend
    const paceSeries = activities.slice().reverse().slice(-12).map(a => ({
      date: a.date,
      pace: a.avg_pace_sec_km,
      hr: a.avg_hr,
    }))
    // PRs (best efforts by distance bucket)
    const sorted = [...activities].sort((a, b) => a.avg_pace_sec_km - b.avg_pace_sec_km)
    // Goal progress — consistency 28d (A+3A): completed / planned from preferred_days
    let goalProgress = null
    const plannedPerWeek = goal?.preferred_days?.length || goal?.days_per_week || 0
    const planned = plannedPerWeek ? plannedPerWeek * 4 : 0
    if (planned > 0) {
      const cutoff = Date.now() - 28 * 86400000
      const completed = activities.filter(a => {
        const t = a.date ? new Date(a.date).getTime() : 0
        return t >= cutoff
      }).length
      // not enough history (<14d of data) → honest empty rather than fake 62%
      const earliest = activities.length ? Math.min(...activities.map(a => (a.date ? new Date(a.date).getTime() : Infinity))) : Infinity
      const daysOfHistory = Number.isFinite(earliest) ? (Date.now() - earliest) / 86400000 : 0
      if (daysOfHistory >= 14 || completed > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((completed / planned) * 100)))
        goalProgress = { pct, planned, completed }
      }
    }
    res.json({
      trainingState: state,
      volumeSeries,
      paceSeries,
      records: sorted.slice(0, 3).map(a => ({ id: a.strava_activity_id ?? a.id ?? a._id, date: a.date, distance_km: a.distance_km, pace: a.avg_pace_sec_km })),
      totalActivities: activities.length,
      totalDistance: +activities.reduce((s, a) => s + (a.distance_km ?? 0), 0).toFixed(1),
      goalProgress,
    })
  } catch (e) { next(e) }
})

export default router
