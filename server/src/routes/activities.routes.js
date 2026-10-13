import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.js'
import { parsePagination } from '../utils/pagination.js'
import { Activity } from '../models/Activity.js'
import { Athlete } from '../models/Athlete.js'
import { getActivity } from '../services/strava.service.js'
import { extractTrophies } from '../services/activity.service.js'
import mongoose from 'mongoose'

const router = Router()

// Never send Strava raw blob / internals to client.
function sanitizeActivity(a) {
  if (!a || typeof a !== 'object') return a
  const { raw: _raw, __v: _v, ...safe } = a
  return { ...safe, id: a.strava_activity_id ?? a.id ?? a._id }
}

router.get('/', requireAuthForUserData, async (req, res, next) => {
  try {
    const athleteId = await getRequestAthleteId(req)
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const { page, perPage, skip } = parsePagination(req.query)
    const filter = { athlete: athleteId }
    if (req.query.type && req.query.type !== 'all') filter.workout_type = req.query.type
    const [rawItems, total] = await Promise.all([
      Activity.find(filter).sort({ date: -1 }).skip(skip).limit(perPage).select('-raw').lean(),
      Activity.countDocuments(filter),
    ])
    const items = rawItems.map(a => sanitizeActivity(a))
    res.json({ items, total, page, perPage })
  } catch (e) { next(e) }
})

router.get('/:id', requireAuthForUserData, async (req, res, next) => {
  try {
    const raw = req.params.id
    const id = Number(raw)
    let act = null
    if (!Number.isNaN(id)) act = await Activity.findOne({ strava_activity_id: id }).select('-raw').lean()
    if (!act && mongoose.isValidObjectId(raw)) act = await Activity.findById(raw).select('-raw').lean()
    if (!act) return res.status(404).json({ error: 'Not found' })
    // Ownership check — 404 on mismatch so IDs not enumerable across users.
    const requesterId = await getRequestAthleteId(req)
    if (!requesterId) return res.status(401).json({ error: 'Not authenticated' })
    if (act.athlete && String(act.athlete) !== String(requesterId)) return res.status(404).json({ error: 'Not found' })

    // Best-effort live trophies via Strava GET /activities/{id}?include_all_efforts=true (segment_efforts.achievements)
    // ponytail: one Strava call, cached back to DB; fallback to stored trophies if unauthenticated/rate-limited
    try {
      const rawToken = req.cookies?.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (rawToken && mongoose.connection.readyState === 1) {
        const payload = jwt.verify(rawToken, env.jwtSecret)
        const athlete = payload.athleteId
          ? await Athlete.findById(payload.athleteId)
          : payload.stravaId ? await Athlete.findOne({ strava_athlete_id: payload.stravaId }) : null
        if (athlete?.access_token && act.strava_activity_id) {
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

    res.json(sanitizeActivity(act))
  } catch (e) { next(e) }
})

export default router
