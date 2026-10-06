import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { env } from '../config/env.js'

export function authOptional(req, _res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return next()
  try {
    req.user = jwt.verify(token, env.jwtSecret)
  } catch {}
  next()
}

export function authRequired(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    req.user = jwt.verify(token, env.jwtSecret)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

// Open for shared synthetic data, enforced for private user data.
export function requireAuthForUserData(req, res, next) {
  if (env.demoMode || mongoose.connection.readyState !== 1) return next()
  return authRequired(req, res, next)
}

// Resolve token → Athlete _id. Supports both token shapes (athleteId preferred, stravaId fallback).
export async function getRequestAthleteId(req) {
  if (req.user?.athleteId && mongoose.isValidObjectId(req.user.athleteId)) return req.user.athleteId
  if (req.user?.stravaId) {
    const { Athlete } = await import('../models/Athlete.js')
    const a = await Athlete.findOne({ strava_athlete_id: req.user.stravaId }).select('_id').lean()
    if (a) return String(a._id)
  }
  return null
}
