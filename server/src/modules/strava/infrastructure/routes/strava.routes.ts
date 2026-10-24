import { Router } from 'express'
import type { CookieOptions, Request } from 'express'
import crypto from 'node:crypto'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { getAuthorizeUrl, exchangeCode, getAthlete, listActivities, getAthleteZones, deauthorize, StravaRateLimitError } from '@/modules/strava/application/strava.service.ts'
import { signToken, sessionCookieOptions } from '@/modules/shared/infrastructure/http/auth.ts'
import { getSession } from '@/modules/athlete/application/session.service.ts'
import { decryptToken, encryptToken } from '@/modules/shared/infrastructure/utils/tokenCrypto.ts'
import { redactSecrets } from '@/modules/shared/infrastructure/utils/redact.ts'
import { clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'
import { normalizeActivity, isRelevantRun, classifyActivity, RUN_SPORTS } from '@/modules/activities/application/activity.service.ts'
import { Athlete, CONNECTED_ATHLETE_FILTER } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { Activity, OTHER_WORKOUT_TYPE } from '@/modules/activities/infrastructure/persistence/Activity.ts'
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

/**
 * Only a same-origin path survives the OAuth round trip. Rejects absolute
 * URLs, protocol-relative paths and backslash tricks, and caps the length so a
 * crafted link cannot bloat the cookie.
 */
function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  return value
}

router.get('/authorize', (req, res) => {
  // Generate CSRF state, bind to httpOnly cookie, verify on callback.
  const state = crypto.randomBytes(16).toString('hex')
  res.cookie('oauth_state', state, sessionCookies({ maxAge: 10 * 60 * 1000 }))
  // The page the athlete wanted is carried through the hop: mobile browsers
  // leave the PWA for Strava and come back in a new tab, so without this the
  // destination would reset to the generic dashboard.
  const next = safeNextPath(req.query.next)
  if (next) res.cookie('oauth_next', next, sessionCookies({ maxAge: 10 * 60 * 1000 }))
  // Mobile browsers app-switch to installed Strava app; desktop keeps web flow.
  const mobile = /iphone|ipad|ipod|android|mobile/i.test(req.headers['user-agent'] || '')
  res.redirect(getAuthorizeUrl(state, { mobile }))
})

router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query
  // Login page is the public landing for OAuth results — dashboard stays gated.
  const next = safeNextPath(req.cookies?.oauth_next)
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : ''
  res.clearCookie('oauth_next', sessionCookies({ maxAge: undefined }))
  if (error) return res.redirect(`${env.appUrl}/login?error=${encodeURIComponent(String(error))}${nextQuery}`)
  if (!code) return res.status(400).json({ error: 'Missing code' })
  if (!state || state !== req.cookies?.oauth_state) {
    return res.redirect(`${env.appUrl}/login?error=${encodeURIComponent('invalid_state')}${nextQuery}`)
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
        const used = await Athlete.countDocuments(CONNECTED_ATHLETE_FILTER)
        if (used >= limit) {
          return res.redirect(`${env.appUrl}/login?error=${encodeURIComponent('app_full')}`)
        }
      }
      athlete = await Athlete.findOneAndUpdate(
        { strava_athlete_id: data.athlete.id },
        {
          $set: {
            strava_athlete_id: data.athlete.id,
            firstname: data.athlete.firstname,
            lastname: data.athlete.lastname,
            profile: data.athlete.profile,
            access_token: encryptToken(data.access_token),
            refresh_token: encryptToken(data.refresh_token),
            expires_at: data.expires_at,
          },
          // Reconnecting restores the slot a disconnect freed.
          $unset: { disconnected_at: 1 },
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
    res.redirect(`${env.appUrl}/login?connected=1`)
  } catch (err) {
    console.error('[strava callback]', redactSecrets(err instanceof Error ? err.message : String(err)))
    res.redirect(`${env.appUrl}/login?error=oauth_failed`)
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

// Session-only logout: clears the cookie and revokes our JWT, but keeps the
// Strava grant (and the athlete slot) intact. Used by the user menu.
router.post('/logout', async (req, res) => {
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

// Real disconnect: revoke the grant at Strava, drop the tokens, and free the
// athlete slot (capacity counts connected rows). Training history stays.
router.post('/disconnect', async (req, res) => {
  try {
    const { athlete, athleteId } = await sessionFor(req, { withCredentials: true })
    if (athleteId && mongoose.connection.readyState === 1 && mongoose.isValidObjectId(athleteId)) {
      if (typeof athlete?.access_token === 'string' && athlete.access_token) {
        try {
          await deauthorize(decryptToken(athlete.access_token))
        } catch (error) {
          // Strava unreachable or the grant was already gone: still finish the
          // local disconnect, otherwise the athlete stays half-connected.
          console.warn('[strava] deauthorize failed:', error instanceof Error ? error.message : error)
        }
      }
      await Athlete.updateOne(
        { _id: athleteId },
        {
          $set: { disconnected_at: new Date() },
          $unset: { access_token: 1, refresh_token: 1, expires_at: 1 },
          $inc: { tokenVersion: 1 },
        }
      )
      clearAiCacheForAthlete(String(athleteId))
    }
  } catch (error) {
    console.debug('[strava] disconnect failed:', error instanceof Error ? error.message : error)
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

  // Auto-import fires on app load; this guard keeps a tab loop from spending the
  // Strava quota. A manual press sends ?force=1. The window matches the client's
  // stale check (15 min), so the two cannot ping-pong.
  const SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000
  const force = req.query.force === '1' || (req.body as { force?: unknown } | undefined)?.force === true
  const lastSyncMs = athlete.last_synced_at ? new Date(athlete.last_synced_at).getTime() : 0
  if (!force && lastSyncMs && Date.now() - lastSyncMs < SYNC_MIN_INTERVAL_MS) {
    return res.json({
      imported: 0,
      skipped: 0,
      totalFetched: 0,
      total: 0,
      truncated: false,
      guarded: true,
      last_synced_at: athlete.last_synced_at,
    })
  }

  // Paginate Strava: GET /athlete/activities handles after/before/page/per_page.
  // Every activity type is imported. Runs get the pace/duration classifier;
  // anything else (ride, swim, HIIT, strength …) keeps `workout_type: 'other'`
  // and its `kind`, which is what the training engine reasons about.
  const perPage = 50
  const MAX_SYNC_PAGES = 10 // 500 activities/sync max — bounds quota burn + request time
  let page = 1
  let imported = 0
  let skipped = 0
  let totalFetched = 0
  let truncated = false
  // Incremental sync: only fetch activities after last sync (Strava `after` is
  // epoch seconds). The window starts `SYNC_OVERLAP_MS` before the watermark
  // because activity `start_date` can precede the sync that first saw it: a
  // watch uploads hours or days late, and a reconnect must not skip history.
  // Re-fetching the overlap is safe — the write is an idempotent upsert.
  const SYNC_OVERLAP_MS = 14 * 86400000
  const after = athlete.last_synced_at
    ? Math.floor((new Date(athlete.last_synced_at).getTime() - SYNC_OVERLAP_MS) / 1000)
    : undefined

  // Compute recent avg pace for classification baseline (from already-stored runs —
  // a ride's speed would skew the pace bands, hence the sport filter)
  const recentRuns = await Activity.find({ athlete: athlete._id, sport: { $in: [...RUN_SPORTS] }, avg_pace_sec_km: { $ne: null } })
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
      const normalized = normalizeActivity(raw)
      const isRun = isRelevantRun(raw)

      // Keep a trimmed raw payload for debugging (avoid storing huge blobs).
      // Built as one object rather than mutating `normalized`, so the added
      // columns stay typed instead of widening the payload to `any`.
      const { raw: _raw, ...doc } = normalized
      const payload = {
        ...doc,
        workout_type: isRun ? classifyActivity(normalized, recentAvgPace) : OTHER_WORKOUT_TYPE,
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

  // New activities invalidate the cached AI week for this athlete: the coaching
  // copy is derived from the same inputs the deterministic plan just re-read.
  if (imported > 0) clearAiCacheForAthlete(String(athlete._id))

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
