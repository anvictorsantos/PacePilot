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
import { WEBHOOK_MAX_BODY_BYTES } from '@/modules/providers/domain/Webhook.ts'

import providersRoutes from '@/modules/providers/infrastructure/routes/providers.routes.ts'
import { providerDescriptors, registerDefaultProviders } from '@/modules/providers/application/provider-registry.ts'
import authRoutes from '@/modules/auth/infrastructure/routes/auth.routes.ts'
import activitiesRoutes from '@/modules/activities/infrastructure/routes/activities.routes.ts'
import planRoutes from '@/modules/training/infrastructure/routes/plan.routes.ts'
import goalsRoutes from '@/modules/athlete/infrastructure/routes/goals.routes.ts'
import meRoutes from '@/modules/athlete/infrastructure/routes/me.routes.ts'
import progressRoutes from '@/modules/progress/infrastructure/routes/progress.routes.ts'
import waitlistRoutes from '@/modules/waitlist/infrastructure/routes/waitlist.routes.ts'
import sentryRoutes from '@/modules/observability/infrastructure/routes/sentry.routes.ts'

// No listen() or connectDB() side effects; middleware order and /api mounts are
// the contract. `staticDir` is optional so tests can compose without a built client.
export function createApp({ staticDir }: { staticDir?: string } = {}) {
  const app = express()
  app.disable('x-powered-by')
  // Registering here, not at module import, lets tests compose a different set.
  registerDefaultProviders()
  const providerImageOrigins = providerDescriptors().flatMap((provider) => provider.imageOrigins)
  // One trusted proxy hop (hosting LB/CDN) so req.ip is the real client IP; raise
  // only when extra proxies sit in front, never to "trust all".
  app.set('trust proxy', 1)
  // CSP also governs the SPA. 'unsafe-eval' stays until vue-i18n catalogues are
  // precompiled; its runtime build otherwise renders raw `{var}`.
  const contentSecurityPolicy = {
    directives: {
      // Catalogue messages are precompiled by @intlify/unplugin-vue-i18n, so the
      // runtime build is used and eval is no longer required.
      scriptSrc: ["'self'", 'https://www.googletagmanager.com'],
      connectSrc: [
        "'self'",
        'https://www.google-analytics.com',
        'https://*.google-analytics.com',
        'https://analytics.google.com',
        'https://*.analytics.google.com',
        'https://*.googletagmanager.com',
        // 3D route map: bundled MapLibre, OSM raster tiles, terrain DEM.
        'https://*.tile.openstreetmap.org',
        'https://tiles.mapterhorn.com',
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://*.google-analytics.com',
        'https://*.googletagmanager.com',
        ...providerImageOrigins,
        'https://*.tile.openstreetmap.org',
        'https://tiles.mapterhorn.com',
      ],
      // MapLibre spawns its worker from a blob URL.
      workerSrc: ["'self'", 'blob:'],
      frameSrc: ['https://www.googletagmanager.com'],
    },
  }
  app.use(helmet({ contentSecurityPolicy }))

  // CLIENT_URL may be comma-separated; normalise to origins, since a trailing
  // slash or path would never match the browser's `Origin` header.
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
  // CORS is for the API only: built vendor chunks load in CORS mode with an
  // Origin header, and a global guard rejected them with the API's 403 JSON.
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
  // Webhooks parse under a tighter limit before the global parser (refused, not
  // buffered); the limiter goes first: an unauthenticated delivery costs a call.
  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => clientIpKey(req),
  })
  const webhookPaths = ['/api/providers/:provider/webhook', '/api/strava/webhook']
  app.use(webhookPaths, webhookLimiter)
  app.use(webhookPaths, express.json({ limit: WEBHOOK_MAX_BODY_BYTES }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  // Authenticated payloads must never enter a shared cache; per-route no-store
  // calls remain as local documentation of the same rule.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(requireSameOrigin)

  // Burn-quota guard; the memory store resets per process, so it is approximate.
  // keyGenerator falls back to proxy headers when req.ip is unset (see utils/clientIpKey.js).
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => clientIpKey(req) })
  const writeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => clientIpKey(req) })
  app.use('/api/', apiLimiter)
  app.use('/api/providers/:provider/sync', writeLimiter)
  app.use('/api/strava/sync', writeLimiter)
  // The historical walk spends provider quota per page like a sync does.
  app.use('/api/providers/:provider/backfill', writeLimiter)
  app.use('/api/strava/backfill', writeLimiter)
  app.use('/api/plan/feedback', writeLimiter)
  app.use('/api/waitlist', writeLimiter)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/providers', providersRoutes)
  // Legacy alias: rewrite the prefix and run the same router. Removed one
  // release after the client stops calling `/api/strava/*`.
  app.use('/api/strava', (req, res, next) => {
    req.url = `/strava${req.url.startsWith('/') ? req.url : `/${req.url}`}`
    providersRoutes(req, res, next)
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/activities', activitiesRoutes)
  app.use('/api/plan', planRoutes)
  app.use('/api/goals', goalsRoutes)
  app.use('/api/me', meRoutes)
  app.use('/api/progress', progressRoutes)
  app.use('/api/waitlist', waitlistRoutes)
  app.use('/api/sentry', sentryRoutes)

  // Before notFound: that middleware answers every request reaching it, so a
  // static layer mounted after it would never run. /api/* misses fall to the 404.
  if (staticDir) {
    app.use(express.static(staticDir))
    // Mirrors client/src/router/index.ts. A new client route must be added here,
    // or its deep link 404s instead of loading the shell.
    const spaPaths = new Set([
      '/',
      '/login',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/connect',
      '/plan',
      '/workout',
      '/progress',
      '/goals',
      '/settings',
    ])
    const spaPrefixes = ['/activities']
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) return next()
      const known =
        spaPaths.has(req.path) ||
        spaPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))
      if (!known) return next()
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  }

  app.use(notFound)
  app.use(errorHandler)

  return app
}
