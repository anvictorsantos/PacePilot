import { Router } from 'express'
import { env } from '../config/env.js'
import { getDemoActivities, getDemoStreams } from '../services/demo.service.js'
import { parsePagination } from '../utils/pagination.js'
import { Activity } from '../models/Activity.js'
import mongoose from 'mongoose'

const router = Router()

function demoMode() { return env.demoMode || mongoose.connection.readyState !== 1 }

router.get('/', async (req, res, next) => {
  try {
    if (demoMode()) {
      const all = getDemoActivities()
      const { page, perPage, skip } = parsePagination(req.query)
      const type = req.query.type
      let filtered = all
      if (type && type !== 'all') filtered = all.filter(a => a.workout_type === type)
      const items = filtered.slice(skip, skip + perPage)
      return res.json({ items, total: filtered.length, page, perPage })
    }
    const { page, perPage, skip } = parsePagination(req.query)
    const filter = {}
    if (req.query.type && req.query.type !== 'all') filter.workout_type = req.query.type
    const [items, total] = await Promise.all([
      Activity.find(filter).sort({ date: -1 }).skip(skip).limit(perPage).lean(),
      Activity.countDocuments(filter),
    ])
    res.json({ items, total, page, perPage })
  } catch (e) { next(e) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (demoMode()) {
      const act = getDemoActivities().find(a => a.id === id)
      if (!act) return res.status(404).json({ error: 'Activity not found' })
      const streams = getDemoStreams(id)
      // synthetic laps
      const laps = [
        { index: 1, distance: 1000, moving_time: 340, avg_speed: 2.94, avg_heartrate: 148 },
        { index: 2, distance: 1000, moving_time: 335, avg_speed: 2.99, avg_heartrate: 152 },
        { index: 3, distance: 1000, moving_time: 338, avg_speed: 2.96, avg_heartrate: 150 },
      ]
      return res.json({ ...act, streams, laps, analysis: `Steady ${act.workout_type} effort. Pace and HR were well-controlled. Good aerobic work.` })
    }
    const act = await Activity.findOne({ strava_activity_id: id }).lean()
    if (!act) return res.status(404).json({ error: 'Not found' })
    res.json(act)
  } catch (e) { next(e) }
})

export default router
