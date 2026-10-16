import { Router } from 'express'
import { requireAuthForUserData, getRequestAthleteId } from '../middleware/auth.ts'
import { parsePagination } from '../utils/pagination.ts'
import { ACTIVITY_WORKOUT_TYPES } from '../models/Activity.ts'
import { Activity } from '../models/Activity.ts'
import { Athlete } from '../models/Athlete.ts'
import { getActivity } from '../services/strava.service.ts'
import { extractTrophies } from '../services/activity.service.ts'
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
    // Whitelist string values only — blocks qs operator injection (?type[$ne]=x
    // parses to an object). The set comes from the model enum so it cannot drift:
    // the previous hand-written list omitted 'race', 'hill' and 'unknown', so
    // ?type=race silently returned every activity instead of the races.
    const ALLOWED_TYPES = ACTIVITY_WORKOUT_TYPES
    if (typeof req.query.type === 'string' && req.query.type !== 'all') {
      if (ALLOWED_TYPES.has(req.query.type)) {
        filter.workout_type = req.query.type
      } else {
        // An unrecognised filter must not silently widen to "everything".
        return res.status(400).json({
          error: 'Invalid type',
          details: [{ path: ['type'], message: `must be one of: all, ${[...ALLOWED_TYPES].join(', ')}` }],
        })
      }
    }
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

    // Trophies come from Strava's detailed-activity endpoint
    // (?include_all_efforts=true) and are cached onto the row.
    //
    // BEHAVIOUR CHANGE: this used to run on EVERY GET, so each detail view spent
    // one Strava request against a 100-per-15-minutes budget and any view
    // failure cost a round trip. It is now opt-in via ?refresh_trophies=1 and
    // falls back to the cached row. Stored trophies still render, so the
    // response shape is unchanged.
    if (req.query.refresh_trophies === '1' && mongoose.connection.readyState === 1 && act.strava_activity_id) {
      try {
        const athleteId = await getRequestAthleteId(req)
        const athlete = athleteId
          ? await Athlete.findById(athleteId).select('access_token refresh_token expires_at')
          : null
        if (athlete?.access_token) {
          const detailed = await getActivity(athlete, act.strava_activity_id, true)
          const trophies = extractTrophies(detailed)
          if (trophies.length || detailed.achievement_count !== undefined) {
            act.trophies = trophies.length ? trophies : act.trophies || []
            act.achievement_count = detailed.achievement_count ?? act.achievement_count
            act.pr_count = detailed.pr_count ?? act.pr_count
            await Activity.updateOne(
              { _id: act._id },
              { $set: { trophies: act.trophies, achievement_count: act.achievement_count, pr_count: act.pr_count } }
            ).catch(() => {})
          }
        }
      } catch (error) {
        // Never fail the read because an enrichment call failed.
        console.warn('[activities] trophy refresh failed:', error?.message)
      }
    }

    res.json(sanitizeActivity(act))
  } catch (e) { next(e) }
})

export default router
