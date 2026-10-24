import { Router, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'

import {
  getSession,
  sessionCookieOptions,
  signToken,
} from '@/modules/athlete/application/session.service.ts'
import { requireAuthForUserData } from '@/modules/shared/infrastructure/http/auth.ts'
import { zodDetails } from '@/modules/shared/infrastructure/schemas/respond.ts'
import { clientIpKey } from '@/modules/shared/infrastructure/utils/clientIpKey.ts'
import {
  authenticate,
  markStravaPromptSeen,
  publicUser,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  revokeSessions,
  sendVerificationFor,
  verifyEmail,
  type AuthSessionView,
} from '@/modules/auth/application/auth.service.ts'
import { listConnections } from '@/modules/providers/application/connection.service.ts'
import { emailLocaleFrom } from '@/modules/auth/domain/email-sender.ts'
import {
  credentialsSchema,
  emailSchema,
  emailTokenSchema,
  resetPasswordSchema,
} from '@/modules/auth/infrastructure/schemas/auth.ts'

const router = Router()

// Brute-force guard. The global API limiter is generous; credentials need their
// own budget so a scripted login attempt cannot spend the whole window.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => clientIpKey(req),
})

// Mail sends cost provider quota and can be used to spam an inbox. Tighter than
// credential attempts, and shared by verification resend + password reset.
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => clientIpKey(req),
})

function setSessionCookie(res: Response, token: string): void {
  res.cookie('token', token, { ...sessionCookieOptions(), sameSite: 'lax' })
}

async function sessionResponse(
  user: ReturnType<typeof publicUser>,
  athlete: Record<string, unknown> | null,
): Promise<AuthSessionView> {
  const connections = athlete?._id ? await listConnections(String(athlete._id)) : []
  return {
    authenticated: true,
    user,
    connections,
    strava: {
      connected: connections.some((entry) => entry.provider === 'strava' && entry.connected),
      promptSeen: Boolean(athlete?.strava_prompt_seen_at),
    },
    emailVerified: Boolean(athlete?.email_verified_at),
  }
}

// POST /api/auth/register — create the account and sign in immediately.
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid credentials',
        details: zodDetails(parsed.error),
      })
    }
    const user = await registerAccount(parsed.data.email, parsed.data.password)
    // Best-effort: the account exists even if the provider is down; the resend
    // endpoint covers a failed delivery.
    await sendVerificationFor(user.id, emailLocaleFrom(req.headers['accept-language']))
    const token = signToken({ athleteId: user.id, tv: 0 })
    setSessionCookie(res, token)
    res.status(201).json(await sessionResponse(user, null))
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/login — one uniform failure for unknown email and bad password.
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid credentials',
        details: zodDetails(parsed.error),
      })
    }
    const athlete = await authenticate(parsed.data.email, parsed.data.password)
    if (!athlete) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const token = signToken({
      athleteId: String(athlete._id),
      tv: Number(athlete.tokenVersion ?? 0),
    })
    setSessionCookie(res, token)
    res.json(await sessionResponse(publicUser(athlete), athlete))
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/logout — session only. The Strava grant stays intact.
router.post('/logout', async (req, res) => {
  try {
    const { athleteId } = await getSession(req)
    await revokeSessions(athleteId)
  } catch (error) {
    // Revocation is best-effort: the cookie is cleared regardless.
    console.debug(
      '[auth] logout revocation failed:',
      error instanceof Error ? error.message : error,
    )
  } finally {
    res.clearCookie('token', { ...sessionCookieOptions(), maxAge: undefined })
    res.json({ ok: true })
  }
})

// GET /api/auth/session — the client's gate. Never 401: a public page can ask
// whether someone is signed in without treating "no" as an error.
router.get('/session', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const session = await getSession(req)
    if (!session.payload) {
      return res.json({
        authenticated: false,
        user: null,
        connections: [],
        strava: { connected: false, promptSeen: false },
        emailVerified: false,
      })
    }
    // A verified cookie whose row is gone is not a usable account. When the
    // database is down the row cannot be read, so keep the token's identity and
    // let the data routes answer 503.
    if (session.athlete == null) {
      if (session.revoked || mongoose.connection.readyState === 1) {
        return res.json({
          authenticated: false,
          user: null,
          connections: [],
          strava: { connected: false, promptSeen: false },
          emailVerified: false,
        })
      }
      return res.json({
        authenticated: true,
        user: null,
        connections: [],
        strava: { connected: false, promptSeen: false },
        emailVerified: false,
      })
    }
    res.json(await sessionResponse(publicUser(session.athlete), session.athlete))
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/strava-prompt/seen — the connect screen asked once.
router.post('/strava-prompt/seen', requireAuthForUserData, async (req, res, next) => {
  try {
    const { athleteId } = await getSession(req)
    await markStravaPromptSeen(athleteId)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/verify-email — one-time link from the registration email.
router.post('/verify-email', emailLimiter, async (req, res, next) => {
  try {
    const parsed = emailTokenSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid verification link', details: zodDetails(parsed.error) })
    }
    await verifyEmail(parsed.data.token)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/verify-email/resend — authenticated; no account enumeration.
router.post('/verify-email/resend', emailLimiter, requireAuthForUserData, async (req, res, next) => {
  try {
    const { athleteId } = await getSession(req)
    await sendVerificationFor(athleteId, emailLocaleFrom(req.headers['accept-language']))
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/forgot-password — always the same answer, known address or not.
router.post('/forgot-password', emailLimiter, async (req, res, next) => {
  try {
    const parsed = emailSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid email is required', details: zodDetails(parsed.error) })
    }
    await requestPasswordReset(parsed.data.email, emailLocaleFrom(req.headers['accept-language']))
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/reset-password — consumes the link and revokes every session.
router.post('/reset-password', emailLimiter, async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reset request', details: zodDetails(parsed.error) })
    }
    await resetPassword(parsed.data.token, parsed.data.password)
    res.clearCookie('token', { ...sessionCookieOptions(), maxAge: undefined })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
