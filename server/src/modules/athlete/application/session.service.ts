/**
 * Session service — the one place that answers "who is the athlete on this
 * request".
 *
 * Before this module that question had six answers spread over two files:
 * `authOptional`, `authRequired`, `requireAuthForUserData`, `readSession`,
 * `extractSessionToken`/`verifySessionToken` and `getRequestAthleteId`. They
 * returned three different shapes — a JWT payload, an id string, or an Athlete
 * document — and each route re-ran verification and its own athlete lookup, so
 * one `GET /api/plan/week` read the Athlete row three times.
 *
 * The interface is deliberately small. `resolveSession(req)` does the whole job
 * once: extract → verify → revocation check → load the athlete. Callers that
 * read more than once in a request go through `getSession`, which caches the
 * result on the request itself, so verification and the load happen once.
 *
 * Revocation is checked against the athlete row we already loaded (tokenVersion),
 * not with a second query. An unreachable database fails open here — every data
 * route requires the database anyway and reports 503 through its own loader.
 */
import type { CookieOptions } from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'
import mongoose from 'mongoose'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'

const BEARER = /^Bearer\s+/i

/** Request slots `getSession` caches into. Two, because the Strava proxy routes
 *  need the credentials the projection strips everywhere else. */
const SESSION_SLOT = Symbol.for('pacepilot.session')
const CREDENTIAL_SESSION_SLOT = Symbol.for('pacepilot.session.credentials')

/** What a session token carries. Slim by design: ids + token version, never names. */
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

/** A loaded athlete row. Deliberately untyped beyond the document: the mongoose
 *  schema is the source of truth and the fields differ per route. */
export type AthleteDoc = Record<string, any> & { _id?: any }

export interface AthleteSession {
  /** Verified token payload, or null when there is no usable token. */
  payload: SessionPayload | null
  /** The athlete row, loaded once. Null when there is no session, no row, or no DB. */
  athlete: AthleteDoc | null
  /** Canonical athlete id for query filters — available even when the row is gone. */
  athleteId: string | null
  /** True when the token's version is behind the athlete's (disconnect happened). */
  revoked: boolean
}

/**
 * `getSession` writes the resolved session onto the request under a symbol key
 * plus a `session` alias. Declaring the alias on Express' `Request` lets
 * downstream middleware (the AI quota limiter) read it without re-resolving.
 */
declare global {
  namespace Express {
    interface Request {
      session?: AthleteSession
    }
  }
}

/**
 * The request surface this service reads. Structural, so a plain object (tests,
 * non-Express callers) and the Express `Request` both satisfy it. The symbol
 * slot is where `getSession` caches its result.
 */
interface SessionRequest {
  cookies?: { token?: unknown }
  headers?: { authorization?: unknown }
  session?: AthleteSession
}

/** Read the symbol slot `getSession` caches into. Only this module writes it, so
 *  the cast is sound; the request may be a plain object in tests. */
function cachedSession(
  req: SessionRequest | null | undefined,
  slot: symbol,
): AthleteSession | undefined {
  return (req as { [k: symbol]: AthleteSession | undefined } | null | undefined)?.[slot]
}

/**
 * Read the session token from the httpOnly cookie, falling back to an
 * Authorization header for non-browser API clients.
 *
 * Returns the raw string rather than a verified payload: a well-formed string
 * that fails signature verification is a distinct fact from "no token at all",
 * and some callers treat the two differently.
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

/** Sign a session payload. 429-style failures are the caller's to classify. */
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
 * Session revocation via per-athlete tokenVersion. Tokens carry `tv`;
 * disconnect bumps the DB column. Old tokens without `tv` count as 0.
 *
 * Fails open when the database is unreachable: the id cannot be checked, and
 * the data routes that care require the database anyway.
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
 * Load the athlete the token points at, in the shape the caller needs.
 * `withCredentials` returns a hydrated document (savable, tokens included) —
 * the Strava proxy routes refresh and persist tokens. Default is lean and
 * token-free, so no route can accidentally forward a Strava credential.
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

/**
 * Resolve the request's session: verify the token, check revocation, load the
 * athlete. Never throws — an unreachable database yields `athlete: null`.
 */
export async function resolveSession(
  req?: SessionRequest | null,
  { withCredentials = false }: { withCredentials?: boolean } = {}
): Promise<AthleteSession> {
  const payload = verifyToken(extractToken(req))
  if (!payload) return { payload: null, athlete: null, athleteId: null, revoked: false }

  // No database: neither revocation nor the row can be read. The id from the
  // token is still authoritative for query filters.
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

/**
 * Resolve the session at most once per request. The Express middleware and the
 * route handler share the same resolved value, so a request costs one
 * verification and one athlete read however many times it asks.
 */
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
    // Non-enumerable alias so middleware that runs after the adapter — the AI
    // quota limiter, keyed per athlete — can read the resolved id without
    // resolving the session a second time.
    if (!withCredentials && !req.session) {
      Object.defineProperty(req, 'session', { value: session, enumerable: false, writable: true, configurable: true })
    }
  }
  return session
}
