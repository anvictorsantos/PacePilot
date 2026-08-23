import { Router } from 'express'
import { env } from '../config/env.js'
import { getDemoActivities, getDemoGoal } from '../services/demo.service.js'
import { calcTrainingState, weeklyVolumeSeries } from '../services/training.service.js'
import mongoose from 'mongoose'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    let activities
    let goal = null
    if (env.demoMode || mongoose.connection.readyState !== 1) {
      activities = getDemoActivities()
      goal = getDemoGoal()
    } else {
      const { Activity } = await import('../models/Activity.js')
      const { Athlete } = await import('../models/Athlete.js')
      activities = await Activity.find().lean()
      const athlete = await Athlete.findOne().lean()
      goal = athlete?.goal || null
    }
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
