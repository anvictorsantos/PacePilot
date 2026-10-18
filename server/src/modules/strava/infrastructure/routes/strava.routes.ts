import { Router } from 'express'
import type { CookieOptions, Request } from 'express'
import crypto from 'node:crypto'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { getAuthorizeUrl, exchangeCode, getAthlete, listActivities, getAthleteZones, StravaRateLimitError } from '@/modules/strava/application/strava.service.ts'
import { signToken, sessionCookieOptions } from '@/modules/shared/infrastructure/http/auth.ts'
import { getSession } from '@/modules/athlete/application/session.service.ts'
import { encryptToken } from '@/modules/shared/infrastructure/utils/tokenCrypto.ts'
import { redactSecrets } from '@/modules/shared/infrastructure/utils/redact.ts'
import { normalizeActivity, isRelevantRun, classifyActivity } from '@/modules/activities/application/activity.service.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { Activity } from '@/modules/activities/infrastructure/persistence/Activity.ts'
import mongoose from 'mongoose'

const router = Router()

// sessionCookieOptions() lets `sameSite` widen to `string`, which express's
// CookieOptions rejects. Re-state the literal it already sets (never anything
// else), so the spread stays assignable without changing the cookie's flags.
function sessionCookies(overrides: CookieOptions = {}): CookieOptions {
  return { ...sessionCookieOptions(), sameSite: 'lax', ...overrides }
}

// `getSession` declares a symbol-keyed cache slot on its structural request
// argument that Express's `Request` type does not. It is the same object at
// runtime; bridge the two type views once here rather than at every call site.
function sessionFor(req: Request, options?: { withCredentials?: boolean }) {
  return getSession(req as unknown as Parameters<typeof getSession>[0], options)
}

router.get('/authorize', (req, res) => {
  // Generate CSRF state, bind to httpOnly cookie, verify on callback.
  const state = crypto.randomBytes(16).toString('hex')
  res.cookie('oauth_state', state, sessionCookies({ maxAge: 10 * 60 * 1000 }))
  // Mobile browsers app-switch to installed Strava app; desktop keeps web flow.
  const mobile = /iphone|ipad|ipod|android|mobile/i.test(req.headers['user-agent'] || '')
  res.redirect(getAuthorizeUrl(state, { mobile }))
})

router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query
  // Login page is the public landing for OAuth results — dashboard stays gated.
  if (error) return res.redirect(`${env.clientUrl}/login?error=${encodeURIComponent(String(error))}`)
  if (!code) return res.status(400).json({ error: 'Missing code' })
  if (!state || state !== req.cookies?.oauth_state) {
    return res.redirect(`${env.clientUrl}/login?error=${encodeURIComponent('invalid_state')}`)
  }
  res.clearCookie('oauth_state', sessionCookies({ maxAge: undefined }))
  try {
    const data = await exchangeCode(String(code))
    let athlete = null
    if (mongoose.connection.readyState === 1) {
      const existing = await Athlete.findOne({ strava_athlete_id: data.athlete.id }).select('_id').lean()
      if (!existing) {
        // Athlete cap (Strava quota): new athletes rejected when full, with a
        // waitlist redirect instead of a failing Strava-side authorization.
        const limit = parseInt(process.env.STRAVA_ATHLETE_LIMIT || '10', 10) || 10
        const used = await Athlete.countDocuments({ strava_athlete_id: { $ne: null } })
        if (used >= limit) {
          return res.redirect(`${env.clientUrl}/login?error=${encodeURIComponent('app_full')}`)
        }
      }
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
    res.cookie('token', token, sessionCookies())
    res.redirect(`${env.clientUrl}/login?connected=1`)
  } catch (err) {
    console.error('[strava callback]', redactSecrets(err instanceof Error ? err.message : String(err)))
    res.redirect(`${env.clientUrl}/login?error=oauth_failed`)
  }
})

router.get('/status', async (req, res) => {
  // Any credential source counts as a session, not just the cookie: an
  // Authorization-only client was being told it was disconnected.
  try {
    const { payload, athlete, revoked } = await sessionFor(req, { withCredentials: true })
    if (!payload || revoked) return res.json({ connected: false, last_synced_at: null })
    // Dot must match reality: a valid JWT alone is not enough — sync needs stored
    // Strava credentials. No tokens (or DB down) → not connected.
    if (!athlete?.access_token) return res.json({ connected: false, last_synced_at: athlete?.last_synced_at || null })
    res.json({ connected: true, last_synced_at: athlete?.last_synced_at || null })
  } catch { res.json({ connected: false, last_synced_at: null }) }
})

router.get('/athlete', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const { payload, revoked, athlete } = await sessionFor(req, { withCredentials: true })
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session' })
  if (revoked) return res.status(401).json({ error: 'Session revoked' })
  if (!athlete?.access_token) return res.status(401).json({ error: 'No Strava credentials' })
  try {
    const profile = await getAthlete(athlete)
    // cache badge for offline Achievements display
    if (profile?.badge_type_id !== undefined) athlete.badge_type_id = profile.badge_type_id
    if (profile?.badges) athlete.badges = profile.badges
    await athlete.save()
    res.json({ badge_type_id: profile.badge_type_id ?? athlete.badge_type_id ?? 0, badges: profile.badges || athlete.badges || [], firstname: profile.firstname, premium: profile.premium })
  } catch (err) {
    if (err instanceof StravaRateLimitError) return res.status(429).json({ error: err.message })
    // fallback to cached badge if Strava fetch fails
    if (athlete.badge_type_id !== undefined) return res.json({ badge_type_id: athlete.badge_type_id, badges: athlete.badges || [], cached: true })
    throw err
  }
})

router.post('/disconnect', async (req, res) => {
  // Revoke server-side so stolen cookies die, then clear client cookie.
  try {
    const { athleteId } = await sessionFor(req)
    if (athleteId && mongoose.connection.readyState === 1 && mongoose.isValidObjectId(athleteId)) {
      await Athlete.findByIdAndUpdate(athleteId, { $inc: { tokenVersion: 1 } })
    }
  } catch (error) {
    // Revocation is best-effort: the cookie is cleared either way, and an
    // unverifiable token cannot be attributed to an athlete.
    console.debug('[strava] best-effort token revocation failed:', error instanceof Error ? error.message : error)
  } finally {
    res.clearCookie('token', sessionCookies({ maxAge: undefined }))
    res.json({ ok: true })
  }
})

router.post('/sync', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }

  // Resolve athlete from the session set by the OAuth callback.
  const { payload, revoked, athlete } = await sessionFor(req, { withCredentials: true })
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session — reconnect Strava' })
  if (revoked) return res.status(401).json({ error: 'Session revoked — reconnect Strava' })

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
    ? recentRuns.reduce((s, r) => s + (r.avg_pace_sec_km ?? 0), 0) / recentRuns.length
    : null

  // Collect operations and write them in bulk.
  //
  // This used to issue one findOne + one save/create per activity — up to 1000
  // sequential round trips per sync, which is why a 500-activity first sync took
  // minutes and burned the request budget. bulkWrite sends one command per
  // activity but resolves them in a single round trip.
  const writeOps = []

  while (true) {
    if (page > MAX_SYNC_PAGES) { truncated = true; break }
    let batch
    try {
      batch = await listActivities(athlete, { after, page, perPage })
    } catch (err) {
      if (err instanceof StravaRateLimitError) return res.status(429).json({ error: err.message, imported, skipped, totalFetched, truncated })
      throw err
    }
    if (!Array.isArray(batch) || batch.length === 0) break
    totalFetched += batch.length

    const ids = batch.map((a) => a.id)
    // One indexed lookup for the whole page instead of one per activity.
    const existing = await Activity.find({ strava_activity_id: { $in: ids } }).select('_id strava_activity_id').lean()
    const knownIds = new Set(existing.map((e) => e.strava_activity_id))

    for (const raw of batch) {
      if (!isRelevantRun(raw)) { skipped++; continue }
      const normalized = normalizeActivity(raw)

      // Keep a trimmed raw payload for debugging (avoid storing huge blobs).
      // Built as one object rather than mutating `normalized`, so the added
      // columns stay typed instead of widening the payload to `any`.
      const { raw: _raw, ...doc } = normalized
      const payload = {
        ...doc,
        workout_type: classifyActivity(normalized, recentAvgPace),
        athlete: athlete._id,
        strava_activity_id: raw.id,
        raw,
      }

      if (knownIds.has(raw.id)) {
        // Update in place so re-sync picks up corrections from Strava
        skipped++
        writeOps.push({ updateOne: { filter: { strava_activity_id: raw.id }, update: { $set: payload } } })
      } else {
        imported++
        // upsert, not insert: two syncs racing must not create duplicates even
        // though the pre-check above already believed this row was new.
        writeOps.push({ updateOne: { filter: { strava_activity_id: raw.id }, update: { $set: payload }, upsert: true } })
      }
    }

    if (batch.length < perPage) break
    page++
  }

  // Chunked so one oversized batch cannot exceed the 16MB driver document limit
  // or the 100k write limit, and so partial progress lands as we go.
  if (writeOps.length) {
    const CHUNK = 100
    for (let i = 0; i < writeOps.length; i += CHUNK) {
      await Activity.bulkWrite(writeOps.slice(i, i + CHUNK), { ordered: false })
    }
  }

  // Import HR zones (powers target_hr — replaces hardcoded 125–185). Best-effort: don't fail sync if zones unavailable.
  try {
    const zones = await getAthleteZones(athlete)
    if (zones) athlete.zones = zones
  } catch (error) {
    console.warn('[strava] failed to populate athlete zones:', error instanceof Error ? error.message : error)
  }

  athlete.last_synced_at = new Date()
  await athlete.save()

  res.json({ imported, skipped, totalFetched, total: imported + skipped, truncated, last_synced_at: athlete.last_synced_at, zones: !!athlete.zones })
})

export default router
