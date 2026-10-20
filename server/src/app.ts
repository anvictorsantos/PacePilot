import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { errorHandler, notFound } from '@/modules/shared/infrastructure/http/errorHandler.ts'
import { requireSameOrigin } from '@/modules/shared/infrastructure/http/auth.ts'
import { clientIpKey } from '@/modules/shared/infrastructure/utils/clientIpKey.ts'

import stravaRoutes from '@/modules/strava/infrastructure/routes/strava.routes.ts'
import activitiesRoutes from '@/modules/activities/infrastructure/routes/activities.routes.ts'
import planRoutes from '@/modules/training/infrastructure/routes/plan.routes.ts'
import goalsRoutes from '@/modules/athlete/infrastructure/routes/goals.routes.ts'
import meRoutes from '@/modules/athlete/infrastructure/routes/me.routes.ts'
import progressRoutes from '@/modules/progress/infrastructure/routes/progress.routes.ts'
import waitlistRoutes from '@/modules/waitlist/infrastructure/routes/waitlist.routes.ts'
import sentryRoutes from '@/modules/observability/infrastructure/routes/sentry.routes.ts'

// Application factory — no listen(), no connectDB() side effects.
// Shared by long-running server (src/index.js) and serverless
// Netlify Function (netlify/functions/api.mjs). Middleware order
// and /api mount points must stay identical in both runtimes.
//
// `staticDir` is the one host-specific knob: passing it makes this process the
// SPA origin (Render), omitting it keeps Netlify's CDN serving client/dist.
export function createApp({ staticDir }: { staticDir?: string } = {}) {
  const app = express()
  app.disable('x-powered-by')
  // Single trusted proxy hop (hosting LB/CDN) so req.ip + rate limiter see real client IP.
  // Raise value only when extra proxies sit in front; never trust all in prod.
  app.set('trust proxy', 1)
  // CSP now governs the SPA too, because this process serves index.html (Render).
  // Two non-default allowances, both previously masked by Netlify's CDN sending
  // no CSP at all:
  // - GA4: dataLayer.ts injects https://www.googletagmanager.com/gtag/js, and
  //   the tag beacons to google-analytics.com / analytics.google.com.
  // - 'unsafe-eval': vue-i18n's full build compiles catalogue strings with
  //   `new Function`. The runtime-only build removes it but renders raw `{var}`
  //   unless catalogues are precompiled at build time, so this stays until that
  //   precompilation step exists.
  const contentSecurityPolicy = {
    directives: {
      scriptSrc: ["'self'", "'unsafe-eval'", 'https://www.googletagmanager.com', 'https://unpkg.com'],
      connectSrc: [
        "'self'",
        'https://www.google-analytics.com',
        'https://*.google-analytics.com',
        'https://analytics.google.com',
        'https://*.analytics.google.com',
        'https://*.googletagmanager.com',
        // 3D route map: pinned MapLibre ESM, OSM raster tiles, terrain DEM.
        'https://unpkg.com',
        'https://*.tile.openstreetmap.org',
        'https://tiles.mapterhorn.com',
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://*.google-analytics.com',
        'https://*.googletagmanager.com',
        'https://*.tile.openstreetmap.org',
        'https://tiles.mapterhorn.com',
      ],
      // MapLibre spawns its worker from a blob URL.
      workerSrc: ["'self'", 'blob:'],
      frameSrc: ['https://www.googletagmanager.com'],
    },
  }
  app.use(helmet({ contentSecurityPolicy }))

  // CLIENT_URL may hold comma-separated allowlist (dev + prod origins).
  // Normalize to origins: a trailing slash or a path in the env value would
  // otherwise never match the browser's `Origin` header.
  const allowedOrigins = new Set(
    env.clientUrl
      .split(',')
      .map((value) => {
        try {
          return new URL(value.trim()).origin
        } catch {
          return null
        }
      })
      .filter((origin): origin is string => origin != null),
  )
  const apiCors = cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true) // same-origin / curl
      if (allowedOrigins.has(origin)) return cb(null, true)
      return cb(new Error('CORS origin denied'))
    },
    credentials: true,
  })
  // CORS belongs to the API, not to every response. Module scripts for the
  // built vendor chunks are fetched in CORS mode with an Origin header; a
  // global guard rejected them with the API's 403 JSON when the SPA was served
  // by this process. Same-host requests need no CORS decision either.
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin
    const host = req.headers.host
    if (origin && host) {
      try {
        if (new URL(origin).host === host) return next()
      } catch {
        // A malformed Origin falls through to the allowlist.
      }
    }
    apiCors(req, res, next)
  })
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
  app.use('/api/waitlist', writeLimiter)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/strava', stravaRoutes)
  app.use('/api/activities', activitiesRoutes)
  app.use('/api/plan', planRoutes)
  app.use('/api/goals', goalsRoutes)
  app.use('/api/me', meRoutes)
  app.use('/api/progress', progressRoutes)
  app.use('/api/waitlist', waitlistRoutes)
  app.use('/api/sentry', sentryRoutes)

  // Registered BEFORE notFound: that middleware answers every request reaching
  // it, so a static layer mounted after it would never run. Assets first, then
  // the SPA fallback — /api/* misses fall through to the JSON 404.
  if (staticDir) {
    app.use(express.static(staticDir))
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) return next()
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  }

  app.use(notFound)
  app.use(errorHandler)

  return app
}
