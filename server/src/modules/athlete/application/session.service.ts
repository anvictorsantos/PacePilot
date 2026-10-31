// One answer to "who is the athlete on this request": verify, check revocation
// against the row already loaded, and load the athlete once per request.
import type { CookieOptions } from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'
import mongoose from 'mongoose'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'

const BEARER = /^Bearer\s+/i

/** Two slots: the Strava proxy routes need credentials the projection strips elsewhere. */
const SESSION_SLOT = Symbol.for('pacepilot.session')
const CREDENTIAL_SESSION_SLOT = Symbol.for('pacepilot.session.credentials')

/** Ids and token version only — never names. */
export interface SessionPayload {
  [key: string]: unknown
  athleteId?: string
  stravaId?: number
  tv?: number
  /** Legacy tokens minted before the slim payload — still readable. */
  firstname?: string
  lastname?: string
  profile?: string
}

/** The mongoose schema is the source of truth; fields differ per route. */
export type AthleteDoc = Record<string, any> & { _id?: any }

export interface AthleteSession {
  payload: SessionPayload | null
  /** Null when there is no session, no row, or no database. */
  athlete: AthleteDoc | null
  /** Canonical athlete id for query filters — available even when the row is gone. */
  athleteId: string | null
  /** True when the token's version is behind the athlete's (disconnect happened). */
  revoked: boolean
}

// The `session` alias is declared on Express' Request so the AI quota limiter can
// read the resolved session without re-resolving it.
declare global {
  namespace Express {
    interface Request {
      session?: AthleteSession
    }
  }
}

// Structural so tests can pass a plain object; the symbol slot holds getSession's cache.
interface SessionRequest {
  cookies?: { token?: unknown }
  headers?: { authorization?: unknown }
  session?: AthleteSession
}

/** Only this module writes the slot, so the cast is sound. */
function cachedSession(
  req: SessionRequest | null | undefined,
  slot: symbol,
): AthleteSession | undefined {
  return (req as { [k: symbol]: AthleteSession | undefined } | null | undefined)?.[slot]
}

/**
 * Returns the raw string rather than a verified payload: a well-formed token that
 * fails verification is a distinct fact from "no token at all".
 */
export function extractToken(req?: SessionRequest | null): string | null {
  const cookie = req?.cookies?.token
  if (typeof cookie === 'string' && cookie.trim()) return cookie.trim()
  const header = req?.headers?.authorization
  if (typeof header === 'string' && header.trim()) {
    const stripped = header.replace(BEARER, '').trim()
    if (stripped) return stripped
  }
  return null
}

/** 429-style failures are the caller's to classify. */
export function signToken(payload: SessionPayload | Record<string, unknown>): string {
  // env.jwtExpiresIn is a validated jsonwebtoken duration string ("24h"); its
  // exported type is plain `string`, which does not satisfy the `ms` template
  // literal `SignOptions['expiresIn']` without this assertion.
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] })
}

/** Verify a session token. Returns null on any failure — never throws. */
export function verifyToken(token: string | null): SessionPayload | null {
  if (!token) return null
  try {
    return jwt.verify(token, env.jwtSecret) as SessionPayload
  } catch {
    return null
  }
}

// Parse '30m'/'12h'/'7d' (jsonwebtoken-style) to ms for cookie maxAge. Caps at 30d.
export function sessionMaxAgeMs(): number {
  const m = String(env.jwtExpiresIn || '24h').trim().match(/^(\d+)\s*([smhd])$/i)
  if (!m) return 24 * 3600000
  const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  return Math.min(parseInt(m[1], 10) * mult[m[2].toLowerCase()], 30 * 86400000)
}

/** Single place for session cookie flags — secure on https prod, lax otherwise. */
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
    maxAge: sessionMaxAgeMs(),
  }
}

/**
 * Tokens carry `tv`; disconnect bumps the DB column. Fails open when the database
 * is unreachable — the data routes that care require it anyway.
 */
export async function isSessionRevoked(payload: SessionPayload | null): Promise<boolean> {
  try {
    if (!payload?.athleteId || !mongoose.isValidObjectId(payload.athleteId)) return false
    if (mongoose.connection.readyState !== 1) return false
    const athlete = await Athlete.findById(payload.athleteId).select('tokenVersion').lean()
    if (!athlete) return false
    return (payload.tv ?? 0) !== ((athlete as any).tokenVersion ?? 0)
  } catch {
    return false
  }
}

/** True when a loaded row disagrees with the token's version. Missing row = not revoked. */
function revokedAgainst(payload: SessionPayload, athlete: AthleteDoc | null): boolean {
  if (!athlete) return false
  return (payload.tv ?? 0) !== (athlete.tokenVersion ?? 0)
}

function canonicalId(payload: SessionPayload, athlete: AthleteDoc | null): string | null {
  // The token's own id wins: it survives an erased athlete row, and routes use it
  // to query by `athlete: id` whether or not a document came back.
  if (payload.athleteId && mongoose.isValidObjectId(payload.athleteId)) return String(payload.athleteId)
  return athlete?._id ? String(athlete._id) : null
}

/**
 * `withCredentials` returns a hydrated document (savable, tokens included) for the
 * Strava proxy routes. The default is lean and token-free.
 */
async function loadAthlete(payload: SessionPayload, withCredentials: boolean): Promise<AthleteDoc | null> {
  let query = null
  if (payload.athleteId && mongoose.isValidObjectId(payload.athleteId)) {
    query = Athlete.findById(payload.athleteId)
  } else if (payload.stravaId) {
    query = Athlete.findOne({ strava_athlete_id: payload.stravaId })
  }
  if (!query) return null
  const scoped = withCredentials
    ? query.select('-password_hash')
    : query.select('-access_token -refresh_token -password_hash')
  return withCredentials ? scoped : scoped.lean()
}

/** Never throws — an unreachable database yields `athlete: null`. */
export async function resolveSession(
  req?: SessionRequest | null,
  { withCredentials = false }: { withCredentials?: boolean } = {}
): Promise<AthleteSession> {
  const payload = verifyToken(extractToken(req))
  if (!payload) return { payload: null, athlete: null, athleteId: null, revoked: false }

  // No database: the row cannot be read, but the id from the token is still
  // authoritative for query filters.
  if (mongoose.connection.readyState !== 1) {
    return { payload, athlete: null, athleteId: canonicalId(payload, null), revoked: false }
  }

  const athlete = await loadAthlete(payload, withCredentials)
  const revoked = revokedAgainst(payload, athlete)
  return {
    payload,
    athlete: revoked ? null : athlete,
    athleteId: revoked ? null : canonicalId(payload, athlete),
    revoked,
  }
}

/** Resolve at most once per request; middleware and handler share one verification and load. */
export async function getSession(
  req?: SessionRequest | null,
  { withCredentials = false }: { withCredentials?: boolean } = {}
): Promise<AthleteSession> {
  const slot = withCredentials ? CREDENTIAL_SESSION_SLOT : SESSION_SLOT
  const cached = cachedSession(req, slot)
  if (cached) return cached
  const session = await resolveSession(req, { withCredentials })
  if (req && typeof req === 'object') {
    Object.defineProperty(req, slot, { value: session, enumerable: false, writable: true, configurable: true })
    // Non-enumerable alias so the AI quota limiter, keyed per athlete, reads the
    // resolved id without resolving the session again.
    if (!withCredentials && !req.session) {
      Object.defineProperty(req, 'session', { value: session, enumerable: false, writable: true, configurable: true })
    }
  }
  return session
}
