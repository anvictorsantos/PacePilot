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
import { serviceUnavailable } from '../errors/AppError.ts'

export async function getRecentFeedbacks(athleteId, days = 7) {
  if (!athleteId) return []
  try {
    const since = new Date(Date.now() - days * 86400000)
    return await WorkoutFeedback.find({ athlete: athleteId, date: { $gte: since } })
      .sort({ date: -1 })
      .lean()
  } catch { return [] }
  // ponytail: implicit skip (preferred slot + no activity/feedback after 24h) not yet inferred here — explicit Feedback wins (Q1C/Q6A); add when silent skips need auto-detection
}

function requireDB() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('Database not connected — check MONGODB_URI')
  }
}

export async function getRequestContext(
  req,
  { includeFeedbacks = false, includeZones = false, feedbackDays = 7, includeActivities = true } = {}
) {
  requireDB()
  const athleteId = await getRequestAthleteId(req)
  if (!athleteId) return { unauthorized: true }
  // Callers that only need the goal (GET /api/goals) used to pay for a full
  // read of every activity on the account. Skipping it is opt-out, so existing
  // callers are unaffected.
  const activities = includeActivities
    ? await Activity.find({ athlete: athleteId }).select('-raw').lean()
    : []
  const athlete = await Athlete.findById(athleteId).select('-access_token -refresh_token').lean()
  // Default 7d keeps the deterministic engine's behaviour unchanged. The AI
  // layer widens this — an athlete logging "my shins hurt" on last Tuesday's run
  // expects that to still matter while planning the coming week.
  const feedbacks = includeFeedbacks ? await getRecentFeedbacks(athlete?._id, feedbackDays) : []
  return {
    activities,
    goal: athlete?.goal || null,
    zones: includeZones ? athlete?.zones || null : null,
    feedbacks,
    athlete,
  }
}
