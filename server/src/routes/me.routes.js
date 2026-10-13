import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Athlete } from '../models/Athlete.js'
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

  // If DB has no record yet (e.g. demo or pre-Mongo auth) fall back to token contents
  if (!athlete) {
    if (payload.firstname || payload.stravaId) {
      return res.json({ user: { firstname: payload.firstname || null, lastname: payload.lastname || null, profile: payload.profile || null } })
    }
    return res.json({ user: null })
  }

  const { firstname, lastname, profile } = athlete
  res.json({ user: { firstname, lastname, profile } })
})

export default router
