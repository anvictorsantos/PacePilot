import { Router } from 'express'
import jwt from 'jsonwebtoken'
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
    const [rawItems, total] = await Promise.all([
      Activity.find(filter).sort({ date: -1 }).skip(skip).limit(perPage).lean(),
      Activity.countDocuments(filter),
    ])
    const items = rawItems.map(a => ({ ...a, id: a.strava_activity_id ?? a._id }))
    res.json({ items, total, page, perPage })
  } catch (e) { next(e) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const raw = req.params.id
    const id = Number(raw)
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
    let act = null
    if (!Number.isNaN(id)) act = await Activity.findOne({ strava_activity_id: id }).lean()
    if (!act && mongoose.isValidObjectId(raw)) act = await Activity.findById(raw).lean()
    if (!act) return res.status(404).json({ error: 'Not found' })

    // Best-effort live trophies via Strava GET /activities/{id}?include_all_efforts=true (segment_efforts.achievements)
    // ponytail: one Strava call, cached back to DB; fallback to stored trophies if unauthenticated/rate-limited
    try {
      const rawToken = req.cookies?.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (rawToken && mongoose.connection.readyState === 1) {
        const payload = jwt.verify(rawToken, env.jwtSecret)
        const { Athlete } = await import('../models/Athlete.js')
        const athlete = payload.athleteId
          ? await Athlete.findById(payload.athleteId)
          : payload.stravaId ? await Athlete.findOne({ strava_athlete_id: payload.stravaId }) : null
        if (athlete?.access_token && act.strava_activity_id) {
          const { getActivity } = await import('../services/strava.service.js')
          const { extractTrophies } = await import('../services/activity.service.js')
          const detailed = await getActivity(athlete, act.strava_activity_id, true)
          const trophies = extractTrophies(detailed)
          if (trophies.length || detailed.achievement_count !== undefined) {
            act.trophies = trophies.length ? trophies : act.trophies || []
            act.achievement_count = detailed.achievement_count ?? act.achievement_count
            act.pr_count = detailed.pr_count ?? act.pr_count
            // cache for next list view
            await Activity.updateOne({ _id: act._id }, { $set: { trophies: act.trophies, achievement_count: act.achievement_count, pr_count: act.pr_count } }).catch(() => {})
          }
        }
      }
    } catch {}

    res.json({ ...act, id: act.strava_activity_id ?? act._id })
  } catch (e) { next(e) }
})

export default router
