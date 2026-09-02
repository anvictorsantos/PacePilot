import jwt from 'jsonwebtoken'
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
