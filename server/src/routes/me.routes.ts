import { Router } from 'express'
import mongoose from 'mongoose'
import { getRequestAthleteId, sessionCookieOptions } from '../middleware/auth.ts'
import { readSession } from '../utils/session.ts'

/** Standalone mongod (no replica set) rejects transactions this way. */
function isUnsupportedTransaction(err) {
  const msg = String(err?.message ?? '')
  return (
    err?.code === 20 ||
    /transaction numbers are only allowed on a replica set member or mongos/i.test(msg) ||
    /Transaction numbers are only allowed/i.test(msg)
  )
}
import { Athlete } from '../models/Athlete.ts'
import { Activity } from '../models/Activity.ts'
import { WorkoutFeedback } from '../models/WorkoutFeedback.ts'

const router = Router()

// GET /api/me — who is currently logged in (from JWT cookie set by Strava OAuth)
router.get('/', async (req, res) => {
  const payload = readSession(req)
  if (!payload) return res.json({ user: null })

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

// DELETE /api/me — RGPD/GDPR erasure. Irreversible.
// Clears the session cookie so a stale token dies with the data.
//
// ATOMICITY: three collections are touched. Previously they were three
// independent calls, so a failure on the last one left an account with its
// activities already gone but the athlete row still present — an inconsistent
// account that no longer matched its own plan. A transaction makes erasure all
// or nothing. Standalone mongod (no replica set) cannot transact, so it falls
// back to the ordered deletes and says which path ran.
router.delete('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const athleteId = await getRequestAthleteId(req)
  if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })

  const clearCookie = () => res.clearCookie('token', { ...sessionCookieOptions(), maxAge: undefined })

  const athlete = await Athlete.findById(athleteId).select('_id')
  if (!athlete) {
    clearCookie()
    return res.json({ ok: true, deleted: 0, atomic: false })
  }

  const erase = async (session) => {
    const [activities, feedbacks] = await Promise.all([
      Activity.deleteMany({ athlete: athlete._id }, { session }),
      WorkoutFeedback.deleteMany({ athlete: athlete._id }, { session }),
    ])
    const removed = await Athlete.deleteOne({ _id: athlete._id }, { session })
    return activities.deletedCount + feedbacks.deletedCount + (removed.deletedCount ?? 0)
  }

  let deleted = 0
  let atomic = false
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      deleted = await erase(session)
      atomic = true
    })
  } catch (err) {
    // Standalone mongod has no transactions. Fall back rather than refusing to
    // delete someone's data; report honestly which guarantee was provided.
    if (!isUnsupportedTransaction(err)) throw err
    deleted = await erase(undefined)
  } finally {
    await session.endSession()
  }

  clearCookie()
  res.json({ ok: true, deleted, atomic })
})

export default router
