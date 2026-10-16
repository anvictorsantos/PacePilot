/**
 * Session token extraction — one place, used by every route that reads a session.
 *
 * This block was copy-pasted across activities.routes, me.routes and four
 * handlers in strava.routes, each with its own regex and its own try/catch. Any
 * fix to token parsing (or to the bearer scheme) had to be applied four times,
 * and the copies had already drifted.
 */
import jwt from 'jsonwebtoken'
import { env } from '../config/env.ts'

const BEARER = /^Bearer\s+/i

/**
 * Read the session token from the httpOnly cookie, falling back to an
 * Authorization header for non-browser API clients. Returns null when absent or
 * malformed as a token string (a well-formed string that fails signature
 * verification is returned — verifying it is the caller's decision, because
 * some callers treat an invalid token as anonymous rather than as an error).
 */
export function extractSessionToken(req): string | null {
  const cookie = req?.cookies?.token
  if (typeof cookie === 'string' && cookie.trim()) return cookie.trim()
  const header = req?.headers?.authorization
  if (typeof header === 'string' && header.trim()) {
    const stripped = header.replace(BEARER, '').trim()
    if (stripped) return stripped
  }
  return null
}

/** Verify a session token. Returns null on any failure — never throws. */
export function verifySessionToken(token: string | null) {
  if (!token) return null
  try {
    return jwt.verify(token, env.jwtSecret)
  } catch {
    return null
  }
}

/** Convenience: extract + verify in one call. */
export function readSession(req) {
  return verifySessionToken(extractSessionToken(req))
}
