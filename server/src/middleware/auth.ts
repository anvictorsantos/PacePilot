import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { env } from '../config/env.ts'
import { Athlete } from '../models/Athlete.ts'

export function authOptional(req, _res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return next()
  try {
    req.user = jwt.verify(token, env.jwtSecret)
  } catch (error) {
    console.debug('[auth] invalid session token ignored:', error?.message)
  }
  next()
}

// Session revocation via per-athlete tokenVersion. Tokens carry tv; disconnect bumps DB.
// Old tokens without tv count as 0 (backward compatible until first revocation).
export async function isSessionRevoked(payload) {
  try {
    if (!payload?.athleteId || !mongoose.isValidObjectId(payload.athleteId)) return false
    if (mongoose.connection.readyState !== 1) return false // fail-open without DB (dev only)
    const a = await Athlete.findById(payload.athleteId).select('tokenVersion').lean()
    if (!a) return false
    return (payload.tv ?? 0) !== (a.tokenVersion ?? 0)
  } catch { return false }
}

export async function authRequired(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
  req.user = payload
  if (await isSessionRevoked(payload)) return res.status(401).json({ error: 'Session revoked' })
  next()
}

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

// Parse '30m'/'12h'/'7d' (jsonwebtoken-style) to ms for cookie maxAge. Caps at 30d.
export function sessionMaxAgeMs() {
  const m = String(env.jwtExpiresIn || '24h').trim().match(/^(\d+)\s*([smhd])$/i)
  if (!m) return 24 * 3600000
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()]
  return Math.min(parseInt(m[1], 10) * mult, 30 * 86400000)
}

// Single place for session cookie flags — secure on https prod, lax otherwise.
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
    maxAge: sessionMaxAgeMs(),
  }
}

// Minimal CSRF guard for cookie-auth POSTs: reject cross-origin requests.
// Bearer-auth API clients unaffected (no Origin/Referer sent or matches).
export function requireSameOrigin(req, res, next) {
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
    if (!allowed.includes(got)) return res.status(403).json({ error: 'Cross-origin request forbidden' })
  } catch {
    return res.status(403).json({ error: 'Cross-origin request forbidden' })
  }
  next()
}

// All user data is private — every data route requires a session.
export function requireAuthForUserData(req, res, next) {
  return authRequired(req, res, next)
}

// Resolve token → Athlete _id. Supports both token shapes (athleteId preferred, stravaId fallback).
export async function getRequestAthleteId(req) {
  if (req.user?.athleteId && mongoose.isValidObjectId(req.user.athleteId)) return req.user.athleteId
  if (req.user?.stravaId) {
    const a = await Athlete.findOne({ strava_athlete_id: req.user.stravaId }).select('_id').lean()
    if (a) return String(a._id)
  }
  return null
}
