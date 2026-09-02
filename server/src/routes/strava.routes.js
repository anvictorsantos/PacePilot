import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getAuthorizeUrl, exchangeCode } from '../services/strava.service.js'
import { signToken } from '../middleware/auth.js'
import { Athlete } from '../models/Athlete.js'
import mongoose from 'mongoose'

const router = Router()

router.get('/authorize', (req, res) => {
  if (env.demoMode) return res.status(400).json({ error: 'Demo mode — Strava OAuth disabled' })
  const state = req.query.state || ''
  res.redirect(getAuthorizeUrl(state))
})

router.get('/callback', async (req, res) => {
  const { code, error } = req.query
  if (error) return res.redirect(`${env.clientUrl}/strava?error=${error}`)
  if (!code) return res.status(400).json({ error: 'Missing code' })
  try {
    const data = await exchangeCode(code)
    let athlete = null
    if (mongoose.connection.readyState === 1) {
      athlete = await Athlete.findOneAndUpdate(
        { strava_athlete_id: data.athlete.id },
        {
          strava_athlete_id: data.athlete.id,
          firstname: data.athlete.firstname,
          lastname: data.athlete.lastname,
          profile: data.athlete.profile,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          last_synced_at: new Date(),
        },
        { upsert: true, new: true }
      )
    }
    const token = signToken({
      athleteId: athlete?._id,
      stravaId: data.athlete.id,
      firstname: data.athlete.firstname,
      lastname: data.athlete.lastname,
      profile: data.athlete.profile,
      demo: false,
    })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400 * 1000 })
    res.redirect(`${env.clientUrl}/strava?connected=1`)
  } catch (err) {
    console.error('[strava callback]', err.message)
    res.redirect(`${env.clientUrl}/strava?error=oauth_failed`)
  }
})

router.get('/status', async (req, res) => {
  if (env.demoMode) return res.json({ connected: false, demo: true, last_synced_at: null })
  const token = req.cookies?.token
  if (!token) return res.json({ connected: false, demo: false, last_synced_at: null })
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    let last_synced_at = null
    if (mongoose.connection.readyState === 1) {
      const athlete = payload.athleteId
        ? await Athlete.findById(payload.athleteId).select('last_synced_at').lean()
        : payload.stravaId
          ? await Athlete.findOne({ strava_athlete_id: payload.stravaId }).select('last_synced_at').lean()
          : null
      last_synced_at = athlete?.last_synced_at || null
    }
    res.json({ connected: true, demo: false, last_synced_at })
  } catch { res.json({ connected: false, demo: false, last_synced_at: null }) }
})

router.post('/disconnect', (req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.post('/sync', async (req, res) => {
  if (env.demoMode) return res.json({ imported: 0, demo: true, message: 'Demo mode — no sync needed' })
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }

  // Resolve athlete from JWT (set on OAuth callback). Supports both token shapes.
  const rawToken = req.cookies?.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!rawToken) return res.status(401).json({ error: 'Not authenticated — connect Strava first (POST /api/strava/authorize)' })

  let payload
  try { payload = jwt.verify(rawToken, env.jwtSecret) } catch {
    return res.status(401).json({ error: 'Invalid or expired session — reconnect Strava' })
  }

  const athlete = payload.athleteId
    ? await Athlete.findById(payload.athleteId)
    : payload.stravaId
      ? await Athlete.findOne({ strava_athlete_id: payload.stravaId })
      : null

  if (!athlete?.access_token) {
    return res.status(401).json({ error: 'No Strava credentials found for this session — reconnect Strava' })
  }

  // Paginate Strava: GET /athlete/activities handles after/before/page/per_page.
  // Import runs only (isRelevantRun), classify conservatively, dedup by strava_activity_id.
  const { normalizeActivity, isRelevantRun, classifyActivity } = await import('../services/activity.service.js')
  const { listActivities } = await import('../services/strava.service.js')
  const { Activity } = await import('../models/Activity.js')

  const perPage = 50
  let page = 1
  let imported = 0
  let skipped = 0
  let totalFetched = 0

  // Compute recent avg pace for classification baseline (from already-stored runs)
  const recentRuns = await Activity.find({ athlete: athlete._id, avg_pace_sec_km: { $ne: null } })
    .sort({ date: -1 }).limit(10).lean()
  const recentAvgPace = recentRuns.length
    ? recentRuns.reduce((s, r) => s + r.avg_pace_sec_km, 0) / recentRuns.length
    : null

  while (true) {
    let batch
    try {
      batch = await listActivities(athlete, { page, perPage })
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ error: err.message, imported, skipped, totalFetched })
      throw err
    }
    if (!Array.isArray(batch) || batch.length === 0) break
    totalFetched += batch.length

    for (const raw of batch) {
      if (!isRelevantRun(raw)) { skipped++; continue }
      const normalized = normalizeActivity(raw)
      normalized.workout_type = classifyActivity(normalized, recentAvgPace)
      normalized.athlete = athlete._id

      // Upsert by strava_activity_id (idempotent)
      const { raw: _raw, ...doc } = normalized
      // Keep a trimmed raw payload for debugging (avoid storing huge blobs)
      const existing = await Activity.findOne({ strava_activity_id: raw.id })
      if (existing) {
        // Update in place so re-sync picks up corrections from Strava
        Object.assign(existing, doc)
        existing.raw = raw
        await existing.save()
        skipped++
      } else {
        await Activity.create({ ...doc, strava_activity_id: raw.id, raw })
        imported++
      }
    }

    if (batch.length < perPage) break
    page++
  }

  athlete.last_synced_at = new Date()
  await athlete.save()

  res.json({ imported, skipped, totalFetched, total: imported + skipped })
})

export default router
