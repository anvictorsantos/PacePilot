/**
 * Shared request context — loads the token athlete's activities/goal/zones.
 * Returns { unauthorized: true } with no valid session so routes 401 alike.
 * Throws 503 when MongoDB is down (MONGODB_URI required).
 */
import mongoose from 'mongoose'
import { getRequestAthleteId } from '../middleware/auth.ts'
import { Activity } from '../models/Activity.ts'
import { Athlete } from '../models/Athlete.ts'
import { WorkoutFeedback } from '../models/WorkoutFeedback.ts'

export async function getRecentFeedbacks(athleteId) {
  if (!athleteId) return []
  try {
    const since = new Date(Date.now() - 7 * 86400000)
    return await WorkoutFeedback.find({ athlete: athleteId, date: { $gte: since } })
      .sort({ date: -1 })
      .lean()
  } catch { return [] }
  // ponytail: implicit skip (preferred slot + no activity/feedback after 24h) not yet inferred here — explicit Feedback wins (Q1C/Q6A); add when silent skips need auto-detection
}

function requireDB() {
  if (mongoose.connection.readyState !== 1) {
    const e = new Error('Database not connected — check MONGODB_URI')
    e.status = 503
    throw e
  }
}

export async function getRequestContext(req, { includeFeedbacks = false, includeZones = false } = {}) {
  requireDB()
  const athleteId = await getRequestAthleteId(req)
  if (!athleteId) return { unauthorized: true }
  const activities = await Activity.find({ athlete: athleteId }).select('-raw').lean()
  const athlete = await Athlete.findById(athleteId).select('-access_token -refresh_token').lean()
  const feedbacks = includeFeedbacks ? await getRecentFeedbacks(athlete?._id) : []
  return {
    activities,
    goal: athlete?.goal || null,
    zones: includeZones ? athlete?.zones || null : null,
    feedbacks,
    athlete,
  }
}
