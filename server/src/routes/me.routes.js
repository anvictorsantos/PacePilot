import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getRequestAthleteId, sessionCookieOptions } from '../middleware/auth.js'
import { Athlete } from '../models/Athlete.js'
import { Activity } from '../models/Activity.js'
import { WorkoutFeedback } from '../models/WorkoutFeedback.js'
import mongoose from 'mongoose'

const router = Router()

// GET /api/me — who is currently logged in (from JWT cookie set by Strava OAuth)
router.get('/', async (req, res) => {
  const rawToken = req.cookies?.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!rawToken) return res.json({ user: null })

  let payload
  try { payload = jwt.verify(rawToken, env.jwtSecret) } catch { return res.json({ user: null }) }

  // Prefer athleteId, fall back to stravaId
  let athlete = null
  if (payload.athleteId && mongoose.connection.readyState === 1) {
    athlete = await Athlete.findById(payload.athleteId).lean()
  }
  if (!athlete && payload.stravaId && mongoose.connection.readyState === 1) {
    athlete = await Athlete.findOne({ strava_athlete_id: payload.stravaId }).lean()
  }

  // If DB has no record yet (e.g. pre-Mongo auth) fall back to token contents.
  // New slim tokens carry IDs only — old tokens with names still stub fine.
  if (!athlete) {
    if (payload.firstname || payload.lastname) {
      return res.json({ user: { firstname: payload.firstname || null, lastname: payload.lastname || null, profile: payload.profile || null } })
    }
    return res.json({ user: null })
  }

  const { firstname, lastname, profile } = athlete
  res.json({ user: { firstname, lastname, profile } })
})

// DELETE /api/me — RGPD/GDPR erasure: removes athlete, activities, feedbacks.
// Irreversible. Clears session cookie so stale tokens die with the data.
router.delete('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const athleteId = await getRequestAthleteId(req)
  if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
  const athlete = await Athlete.findById(athleteId).select('_id')
  if (!athlete) {
    res.clearCookie('token', { ...sessionCookieOptions(), maxAge: undefined })
    return res.json({ ok: true, deleted: 0 })
  }
  const [activities, feedbacks] = await Promise.all([
    Activity.deleteMany({ athlete: athlete._id }),
    WorkoutFeedback.deleteMany({ athlete: athlete._id }),
  ])
  await Athlete.deleteOne({ _id: athlete._id })
  res.clearCookie('token', { ...sessionCookieOptions(), maxAge: undefined })
  res.json({ ok: true, deleted: activities.deletedCount + feedbacks.deletedCount + 1 })
})

export default router
