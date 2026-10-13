import { Router } from 'express'
import { env } from '../config/env.js'
import { getDemoActivities } from '../services/demo.service.js'
import { calcTrainingState, weeklyVolumeSeries } from '../services/training.service.js'
import mongoose from 'mongoose'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    let activities
    if (env.demoMode || mongoose.connection.readyState !== 1) activities = getDemoActivities()
    else {
      const { Activity } = await import('../models/Activity.js')
      activities = await Activity.find().lean()
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
    res.json({
      trainingState: state,
      volumeSeries,
      paceSeries,
      records: sorted.slice(0, 3).map(a => ({ id: a.strava_activity_id ?? a.id ?? a._id, date: a.date, distance_km: a.distance_km, pace: a.avg_pace_sec_km })),
      totalActivities: activities.length,
      totalDistance: +activities.reduce((s, a) => s + (a.distance_km ?? 0), 0).toFixed(1),
    })
  } catch (e) { next(e) }
})

export default router
