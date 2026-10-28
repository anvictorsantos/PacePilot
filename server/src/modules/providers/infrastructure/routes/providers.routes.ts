import { Router } from 'express'
import type { CookieOptions, Request, Response } from 'express'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { signToken, sessionCookieOptions } from '@/modules/shared/infrastructure/http/auth.ts'
import { getSession } from '@/modules/athlete/application/session.service.ts'
import { redactSecrets } from '@/modules/shared/infrastructure/utils/redact.ts'
import { clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { Connection } from '@/modules/providers/infrastructure/persistence/Connection.ts'
import { revokeSessions } from '@/modules/auth/application/auth.service.ts'
import {
  ProviderAuthError,
  ProviderError,
} from '@/modules/providers/domain/errors.ts'
import {
  athleteLimit,
  connectedCount,
  disconnectProvider,
  freshAccessToken,
  getConnection,
  linkProviderWithTokens,
  listConnections,
  isConnected,
  touchConnection,
} from '@/modules/providers/application/connection.service.ts'
import { importActivities } from '@/modules/providers/application/activity-import.service.ts'
import { isValidOAuthState, oauthStateCookie } from '@/modules/providers/application/oauth-state.ts'
import {
  getProvider,
  providerDescriptors,
} from '@/modules/providers/application/provider-registry.ts'

const router = Router()

function sessionCookies(overrides: CookieOptions = {}): CookieOptions {
  return { ...sessionCookieOptions(), sameSite: 'lax', ...overrides }
}

function sessionFor(req: Request, options?: { withCredentials?: boolean }) {
  return getSession(req as unknown as Parameters<typeof getSession>[0], options)
}

function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  return value
}

function providerId(req: Request): string {
  return String(req.params.provider || '')
}

function handleProviderError(res: Response, error: unknown): boolean {
  if (error instanceof ProviderError) {
    res.status(error.status).json({ error: error.message, code: error.code, provider: error.provider })
    return true
  }
  return false
}

function clearOauthCookies(res: Response): void {
  for (const name of ['oauth_state', 'oauth_next', 'oauth_popup']) {
    res.clearCookie(name, sessionCookies({ maxAge: undefined }))
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[char] ?? char
  })
}

/** Popup landing: no token in the page; the SPA polls status. */
function popupResultPage(res: Response, status: 'connected' | 'error', code = ''): void {
  const errors: Record<string, string> = {
    invalid_state: 'The connection request expired. Please try again.',
    already_linked: 'That account is already linked to another PacePilot account.',
    app_full: 'Athlete spots are full right now. Please try again later.',
    unavailable: 'The service is unavailable right now. Please try again.',
    connect_requires_login: 'Sign in to PacePilot first, then connect from Settings.',
    oauth_failed: 'The provider did not complete the connection. Please try again.',
    popup_blocked: 'Your browser blocked the connection window.',
  }
  const message =
    status === 'connected'
      ? 'Connection complete. You can close this window.'
      : `${errors[code] ?? 'Connection failed. Please try again.'} You can close this window.`
  res
    .status(200)
    .set('Cache-Control', 'no-store')
    .type('html')
    .send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PacePilot</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0B0F;color:#CECED3;font:14px system-ui,sans-serif;text-align:center;padding:24px}</style>
</head><body><p>${escapeHtml(message)}</p>
<script>
  try {
    if (window.opener) window.opener.postMessage(
      { type: 'pacepilot:connection', status: ${JSON.stringify(status)}, code: ${JSON.stringify(code)} },
      window.location.origin
    )
  } catch (e) {}
  setTimeout(function () { window.close() }, 50)
</script></body></html>`)
}

// GET /api/providers — what the client may render, public and DB-free.
router.get('/', (_req, res) => {
  res.json({ providers: providerDescriptors() })
})

// Connection state is a lifecycle answer, not a document: a cached copy would
// keep telling an already-linked athlete they have no source. Every branch,
// including the signed-out and database-down fallbacks, says no-store.
const NO_STORE = { 'Cache-Control': 'no-store' }

// GET /api/providers/status — aggregated, safe when signed out or DB-down.
router.get('/status', async (req, res) => {
  res.set(NO_STORE)
  try {
    const { payload, revoked } = await sessionFor(req)
    if (!payload || revoked) return res.json({ connected: false, last_synced_at: null, connections: [] })
    const connections = await listConnections(payload.athleteId as string)
    const connected = connections.find((entry) => entry.connected) ?? null
    res.json({
      connected: Boolean(connected),
      provider: connected?.provider ?? null,
      last_synced_at: connected?.last_synced_at ?? null,
      connections,
    })
  } catch {
    res.json({ connected: false, last_synced_at: null, connections: [] })
  }
})

router.get('/:provider/status', async (req, res) => {
  res.set(NO_STORE)
  try {
    const { payload, revoked } = await sessionFor(req)
    if (!payload || revoked) return res.json({ connected: false, last_synced_at: null })
    const connections = await listConnections(payload.athleteId as string)
    const entry = connections.find((item) => item.provider === providerId(req))
    res.json({ connected: Boolean(entry?.connected), last_synced_at: entry?.last_synced_at ?? null })
  } catch {
    res.json({ connected: false, last_synced_at: null })
  }
})

router.get('/:provider/authorize', async (req, res) => {
  const provider = providerId(req)
  // OAuth is a link step: only an authenticated account may attach a source.
  const { payload } = await sessionFor(req)
  if (!payload) {
    const next = safeNextPath(req.query.next) || '/connect'
    return res.redirect(`${env.appUrl}/login?next=${encodeURIComponent(next)}`)
  }
  try {
    getProvider(provider) // 404 for unknown/disabled before touching cookies
  } catch {
    return res.status(404).json({ error: 'Unknown provider' })
  }

  const state = crypto.randomBytes(16).toString('hex')
  res.cookie('oauth_state', oauthStateCookie(provider, state), sessionCookies({ maxAge: 10 * 60 * 1000 }))
  const next = safeNextPath(req.query.next)
  if (next) res.cookie('oauth_next', next, sessionCookies({ maxAge: 10 * 60 * 1000 }))
  if (req.query.popup === '1') {
    res.cookie('oauth_popup', '1', sessionCookies({ maxAge: 10 * 60 * 1000 }))
  }
  const mobile = /iphone|ipad|ipod|android|mobile/i.test(req.headers['user-agent'] || '')
  res.redirect(getProvider(provider).authorizeUrl(state, { mobile }))
})

router.get('/:provider/callback', async (req, res) => {
  const provider = providerId(req)
  const { code, error, state } = req.query
  const popup = req.cookies?.oauth_popup === '1'
  const next = safeNextPath(req.cookies?.oauth_next) || '/workout'
  const nextQuery = next !== '/workout' ? `&next=${encodeURIComponent(next)}` : ''

  if (error) {
    clearOauthCookies(res)
    const errorCode = String(error)
    if (popup) return popupResultPage(res, 'error', errorCode)
    return res.redirect(`${env.appUrl}/login?error=${encodeURIComponent(errorCode)}${nextQuery}`)
  }
  if (!code) return res.status(400).json({ error: 'Missing code' })
  if (!isValidOAuthState(provider, state, req.cookies?.oauth_state)) {
    clearOauthCookies(res)
    if (popup) return popupResultPage(res, 'error', 'invalid_state')
    return res.redirect(`${env.appUrl}/login?error=${encodeURIComponent('invalid_state')}${nextQuery}`)
  }
  clearOauthCookies(res)

  try {
    if (mongoose.connection.readyState !== 1) {
      if (popup) return popupResultPage(res, 'error', 'unavailable')
      return res.redirect(`${env.appUrl}/login?error=unavailable`)
    }

    const session = await sessionFor(req)
    const adapter = getProvider(provider)
    const tokens = await adapter.exchangeCode(String(code))
    let targetId = session.athleteId
    let legacyLogin = false

    // Legacy provider-only accounts predate password signup: they may enter once
    // through OAuth. A modern account must use the form first.
    if (!session.payload) {
      const legacy = tokens.externalAthleteId
        ? await findLegacyAthlete(provider, tokens.externalAthleteId)
        : null
      if (!legacy) {
        if (popup) return popupResultPage(res, 'error', 'connect_requires_login')
        return res.redirect(`${env.appUrl}/login?error=connect_requires_login${nextQuery}`)
      }
      targetId = String(legacy._id)
      legacyLogin = true
    } else if (!targetId) {
      if (popup) return popupResultPage(res, 'error', 'connect_requires_login')
      return res.redirect(`${env.appUrl}/login?error=connect_requires_login${nextQuery}`)
    }

    const alreadyConnected = targetId ? await isConnected(targetId, provider) : false
    if (!alreadyConnected) {
      const [used, limit] = await Promise.all([connectedCount(), athleteLimit()])
      if (used >= limit) {
        if (popup) return popupResultPage(res, 'error', 'app_full')
        return res.redirect(`${env.appUrl}/connect?error=app_full`)
      }
    }

    if (!targetId) {
      if (popup) return popupResultPage(res, 'error', 'connect_requires_login')
      return res.redirect(`${env.appUrl}/login?error=connect_requires_login${nextQuery}`)
    }

    const connection = await linkProviderWithTokens(targetId, provider, tokens)
    await Athlete.updateOne(
      { _id: targetId },
      { $set: { strava_prompt_seen_at: new Date() } },
    )

    if (legacyLogin) {
      const athlete = await Athlete.findById(targetId).lean()
      const token = signToken({
        athleteId: targetId,
        tv: Number((athlete as { tokenVersion?: number } | null)?.tokenVersion ?? 0),
      })
      res.cookie('token', token, sessionCookies())
    }

    if (popup) return popupResultPage(res, 'connected')
    res.redirect(`${env.appUrl}${next}?connected=1`)
    return connection
  } catch (error) {
    if (error instanceof ProviderAuthError) {
      console.warn('[provider callback]', redactSecrets(error.message))
      const code = error.message.includes('already linked') ? 'already_linked' : 'oauth_failed'
      if (popup) return popupResultPage(res, 'error', code)
      return res.redirect(`${env.appUrl}/connect?error=${code}`)
    }
    console.error('[provider callback]', redactSecrets(error instanceof Error ? error.message : String(error)))
    if (popup) return popupResultPage(res, 'error', 'oauth_failed')
    res.redirect(`${env.appUrl}/login?error=oauth_failed`)
  }
})

/**
 * The callback may run before a session exists. It can only adopt an account
 * that predates password signup; a modern account must sign in and link from
 * inside the app.
 */
async function findLegacyAthlete(
  provider: string,
  externalId: string,
): Promise<{ _id: unknown } | null> {
  const connection = await Connection.findOne({
    provider,
    external_athlete_id: externalId,
  })
    .select('athlete')
    .lean()
  if (connection?.athlete) {
    const athlete = await Athlete.findById(connection.athlete).select('+password_hash').lean()
    return athlete && !athlete.password_hash ? athlete : null
  }
  if (provider === 'strava' && /^\d+$/.test(externalId)) {
    const athlete = await Athlete.findOne({ strava_athlete_id: Number(externalId) })
      .select('+password_hash')
      .lean()
    return athlete && !athlete.password_hash ? athlete : null
  }
  return null
}

router.get('/:provider/athlete', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const provider = providerId(req)
  const { payload, revoked } = await sessionFor(req)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session' })
  if (revoked) return res.status(401).json({ error: 'Session revoked' })
  try {
    const connection = await getConnection(payload.athleteId as string, provider, { withCredentials: true })
    if (!connection?.access_token) return res.status(401).json({ error: `No ${provider} credentials` })
    const adapter = getProvider(provider)
    if (!adapter.getProfile) return res.status(404).json({ error: 'Profile not supported' })
    const profile = await adapter.getProfile(await freshAccessToken(connection))
    if (!profile) return res.status(502).json({ error: `${provider} returned no profile` })
    await touchConnection(connection, {
      profile: {
        firstname: profile.firstname ?? undefined,
        lastname: profile.lastname ?? undefined,
        profile: profile.profile ?? undefined,
      },
    })
    res.json({
      badge_type_id: profile.badgeTypeId ?? 0,
      badges: profile.badges ?? [],
      firstname: profile.firstname,
      provider,
    })
  } catch (error) {
    if (handleProviderError(res, error)) return
    throw error
  }
})

// Session-only logout: the provider grant stays intact. Kept under the provider
// prefix for the legacy client; `/api/auth/logout` is the canonical route.
router.post('/:provider/logout', async (req, res) => {
  try {
    const { athleteId } = await sessionFor(req)
    await revokeSessions(athleteId)
  } catch (error) {
    console.debug('[provider] best-effort logout failed:', error instanceof Error ? error.message : error)
  } finally {
    res.clearCookie('token', sessionCookies({ maxAge: undefined }))
    res.json({ ok: true })
  }
})

router.post('/:provider/disconnect', async (req, res) => {
  const provider = providerId(req)
  try {
    const { athleteId } = await sessionFor(req)
    if (athleteId && mongoose.connection.readyState === 1 && mongoose.isValidObjectId(athleteId)) {
      await disconnectProvider(athleteId, provider)
      clearAiCacheForAthlete(athleteId)
    }
  } catch (error) {
    console.debug('[provider] disconnect failed:', error instanceof Error ? error.message : error)
  } finally {
    res.json({ ok: true })
  }
})

router.post('/:provider/sync', async (req, res) => {
  const provider = providerId(req)
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const { payload, revoked } = await sessionFor(req)
  if (!payload) return res.status(401).json({ error: `Invalid or expired session — reconnect ${provider}` })
  if (revoked) return res.status(401).json({ error: `Session revoked — reconnect ${provider}` })
  if (!payload.athleteId) return res.status(401).json({ error: 'Not authenticated' })

  const force = req.query.force === '1' || (req.body as { force?: unknown } | undefined)?.force === true
  try {
    const outcome = await importActivities({ athleteId: payload.athleteId, providerId: provider, force })
    res.json(outcome)
  } catch (error) {
    if (error instanceof ProviderAuthError) return res.status(401).json({ error: error.message })
    if (handleProviderError(res, error)) return
    throw error
  }
})

export default router
