// HTTP shape for the session service: which routes need a session, how a missing or
// revoked one is answered, and the CSRF guard for cookie-auth writes.
import type { NextFunction, Request, Response } from 'express'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { extractToken, getSession } from '@/modules/athlete/application/session.service.ts'

// Callers treat "mint a token" / "set the cookie" as the same concern as reading
// one, and the Strava OAuth callback does both.
export { signToken, sessionMaxAgeMs, sessionCookieOptions } from '@/modules/athlete/application/session.service.ts'

// Minimal CSRF guard for cookie-auth POSTs: reject cross-origin requests.
// Bearer-auth API clients unaffected (no Origin/Referer sent or matches).
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (req.headers.authorization) return next() // token in header, not ambient cookie
  const origin = req.headers.origin || req.headers.referer
  if (!origin) return next() // same-origin browser navs omit Origin on some POSTs; lax cookies still apply
  try {
    // CLIENT_URL may hold comma-separated allowlist — compare against full set.
    const allowed = env.clientUrl.split(',').map(s => {
      try { return new URL(s.trim()).origin } catch { return null }
    }).filter(Boolean)
    const got = new URL(origin, `http://${req.headers.host}`).origin
    // Same-host writes (the SPA served by this process) are not cross-origin,
    // whatever CLIENT_URL names; only a different host needs the allowlist.
    if (req.headers.host && new URL(got).host === req.headers.host) return next()
    if (!allowed.includes(got)) return res.status(403).json({ error: 'Cross-origin request forbidden' })
  } catch {
    return res.status(403).json({ error: 'Cross-origin request forbidden' })
  }
  next()
}

// All user data is private — every data route requires a session.
export async function requireAuthForUserData(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req)
    if (!session.payload) {
      // Distinguish "no credential sent" from "credential rejected": the client
      // treats the first as logged out and the second as needing a reconnect.
      const sent = Boolean(extractToken(req))
      return res.status(401).json({ error: sent ? 'Invalid token' : 'Not authenticated' })
    }
    if (session.revoked) return res.status(401).json({ error: 'Session revoked' })
    next()
  } catch (err) {
    next(err)
  }
}
