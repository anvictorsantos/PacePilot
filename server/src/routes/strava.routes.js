import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getAuthorizeUrl, exchangeCode, getAthlete, listActivities, getAthleteZones } from '../services/strava.service.js'
import { signToken, sessionCookieOptions, isSessionRevoked } from '../middleware/auth.js'
import { encryptToken } from '../utils/tokenCrypto.js'
import { redactSecrets } from '../utils/redact.js'
import { normalizeActivity, isRelevantRun, classifyActivity } from '../services/activity.service.js'
import { Athlete } from '../models/Athlete.js'
import { Activity } from '../models/Activity.js'
import mongoose from 'mongoose'

const router = Router()

router.get('/authorize', (req, res) => {
  // Generate CSRF state, bind to httpOnly cookie, verify on callback.
  const state = crypto.randomBytes(16).toString('hex')
  res.cookie('oauth_state', state, { ...sessionCookieOptions(), maxAge: 10 * 60 * 1000 })
  // Mobile browsers app-switch to installed Strava app; desktop keeps web flow.
  const mobile = /iphone|ipad|ipod|android|mobile/i.test(req.headers['user-agent'] || '')
  res.redirect(getAuthorizeUrl(state, { mobile }))
})

router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query
  if (error) return res.redirect(`${env.clientUrl}/strava?error=${encodeURIComponent(error)}`)
  if (!code) return res.status(400).json({ error: 'Missing code' })
  if (!state || state !== req.cookies?.oauth_state) {
    return res.redirect(`${env.clientUrl}/strava?error=${encodeURIComponent('invalid_state')}`)
  }
  res.clearCookie('oauth_state', { ...sessionCookieOptions(), maxAge: undefined })
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
          access_token: encryptToken(data.access_token),
          refresh_token: encryptToken(data.refresh_token),
          expires_at: data.expires_at,
          last_synced_at: new Date(),
        },
        { upsert: true, new: true }
      )
    }
    // Slim session payload — IDs + token version only. Names come from DB (/api/me).
    const token = signToken({
      athleteId: athlete?._id,
      stravaId: data.athlete.id,
      tv: athlete?.tokenVersion ?? 0,
    })
    res.cookie('token', token, sessionCookieOptions())
    res.redirect(`${env.clientUrl}/strava?connected=1`)
  } catch (err) {
    console.error('[strava callback]', redactSecrets(err?.message))
    res.redirect(`${env.clientUrl}/strava?error=oauth_failed`)
  }
})

router.get('/status', async (req, res) => {
  const token = req.cookies?.token
  if (!token) return res.json({ connected: false, last_synced_at: null })
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    if (await isSessionRevoked(payload)) return res.json({ connected: false, last_synced_at: null })
    let last_synced_at = null
    if (mongoose.connection.readyState === 1) {
      const athlete = payload.athleteId
        ? await Athlete.findById(payload.athleteId).select('last_synced_at').lean()
        : payload.stravaId
          ? await Athlete.findOne({ strava_athlete_id: payload.stravaId }).select('last_synced_at').lean()
          : null
      last_synced_at = athlete?.last_synced_at || null
    }
    res.json({ connected: true, last_synced_at })
  } catch { res.json({ connected: false, last_synced_at: null }) }
})

router.get('/athlete', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const rawToken = req.cookies?.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!rawToken) return res.status(401).json({ error: 'Not authenticated' })
  let payload
  try { payload = jwt.verify(rawToken, env.jwtSecret) } catch { return res.status(401).json({ error: 'Invalid or expired session' }) }
  if (await isSessionRevoked(payload)) return res.status(401).json({ error: 'Session revoked' })
  const athlete = payload.athleteId
    ? await Athlete.findById(payload.athleteId)
    : payload.stravaId ? await Athlete.findOne({ strava_athlete_id: payload.stravaId }) : null
  if (!athlete?.access_token) return res.status(401).json({ error: 'No Strava credentials' })
  try {
    const profile = await getAthlete(athlete)
    // cache badge for offline Achievements display
    if (profile?.badge_type_id !== undefined) athlete.badge_type_id = profile.badge_type_id
    if (profile?.badges) athlete.badges = profile.badges
    await athlete.save()
    res.json({ badge_type_id: profile.badge_type_id ?? athlete.badge_type_id ?? 0, badges: profile.badges || athlete.badges || [], firstname: profile.firstname, premium: profile.premium })
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: err.message })
    // fallback to cached badge if Strava fetch fails
    if (athlete.badge_type_id !== undefined) return res.json({ badge_type_id: athlete.badge_type_id, badges: athlete.badges || [], cached: true })
    throw err
  }
})

router.post('/disconnect', async (req, res) => {
  // Revoke server-side so stolen cookies die, then clear client cookie.
  try {
    const rawToken = req.cookies?.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (rawToken) {
      try {
        const payload = jwt.verify(rawToken, env.jwtSecret)
        if (payload?.athleteId && mongoose.connection.readyState === 1 && mongoose.isValidObjectId(payload.athleteId)) {
          await Athlete.findByIdAndUpdate(payload.athleteId, { $inc: { tokenVersion: 1 } })
        }
      } catch {}
    }
  } finally {
    res.clearCookie('token', { ...sessionCookieOptions(), maxAge: undefined })
    res.json({ ok: true })
  }
})

router.post('/sync', async (req, res) => {
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
  if (await isSessionRevoked(payload)) return res.status(401).json({ error: 'Session revoked — reconnect Strava' })

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
  const perPage = 50
  const MAX_SYNC_PAGES = 10 // 500 activities/sync max — bounds quota burn + request time
  let page = 1
  let imported = 0
  let skipped = 0
  let totalFetched = 0
  let truncated = false
  // Incremental sync: only fetch activities after last sync (Strava `after` is epoch seconds)
  const after = athlete.last_synced_at ? Math.floor(new Date(athlete.last_synced_at).getTime() / 1000) : undefined

  // Compute recent avg pace for classification baseline (from already-stored runs)
  const recentRuns = await Activity.find({ athlete: athlete._id, avg_pace_sec_km: { $ne: null } })
    .sort({ date: -1 }).limit(10).lean()
  const recentAvgPace = recentRuns.length
    ? recentRuns.reduce((s, r) => s + r.avg_pace_sec_km, 0) / recentRuns.length
    : null

  while (true) {
    if (page > MAX_SYNC_PAGES) { truncated = true; break }
    let batch
    try {
      batch = await listActivities(athlete, { after, page, perPage })
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ error: err.message, imported, skipped, totalFetched, truncated })
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

  // Import HR zones (powers target_hr — replaces hardcoded 125–185). Best-effort: don't fail sync if zones unavailable.
  try {
    const zones = await getAthleteZones(athlete)
    if (zones) athlete.zones = zones
  } catch {}

  athlete.last_synced_at = new Date()
  await athlete.save()

  res.json({ imported, skipped, totalFetched, total: imported + skipped, truncated, last_synced_at: athlete.last_synced_at, zones: !!athlete.zones })
})

export default router
