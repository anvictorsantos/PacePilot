import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { requireSameOrigin } from './middleware/auth.js'
import { clientIpKey } from './utils/clientIpKey.js'

import stravaRoutes from './routes/strava.routes.js'
import activitiesRoutes from './routes/activities.routes.js'
import planRoutes from './routes/plan.routes.js'
import goalsRoutes from './routes/goals.routes.js'
import meRoutes from './routes/me.routes.js'
import progressRoutes from './routes/progress.routes.js'

// Application factory — no listen(), no connectDB() side effects.
// Shared by long-running server (src/index.js) and serverless
// Netlify Function (netlify/functions/api.mjs). Middleware order
// and /api mount points must stay identical in both runtimes.
export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // Single trusted proxy hop (hosting LB/CDN) so req.ip + rate limiter see real client IP.
  // Raise value only when extra proxies sit in front; never trust all in prod.
  app.set('trust proxy', 1)
  app.use(helmet())

  // CLIENT_URL may hold comma-separated allowlist (dev + prod origins).
  const allowedOrigins = env.clientUrl.split(',').map(s => s.trim()).filter(Boolean)
  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true) // same-origin / curl
      if (allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error('CORS origin denied'))
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(requireSameOrigin)

  // Burn-quota guard: sync hits Strava per call, feedback writes DB.
  // NOTE: memory store resets per serverless instance — approximate, not strict.
  // keyGenerator: serverless reqs lack socket IP (req.ip undefined) — custom key
  // avoids ERR_ERL_UNDEFINED_IP_ADDRESS crash. See utils/clientIpKey.js.
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => clientIpKey(req) })
  const writeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => clientIpKey(req) })
  app.use('/api/', apiLimiter)
  app.use('/api/strava/sync', writeLimiter)
  app.use('/api/plan/feedback', writeLimiter)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/strava', stravaRoutes)
  app.use('/api/activities', activitiesRoutes)
  app.use('/api/plan', planRoutes)
  app.use('/api/goals', goalsRoutes)
  app.use('/api/me', meRoutes)
  app.use('/api/progress', progressRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
