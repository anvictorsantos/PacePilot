import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import mongoose, { type ClientSession } from 'mongoose'
import { getSession, sessionCookieOptions } from '@/modules/athlete/application/session.service.ts'
import { requireAuthForUserData } from '@/modules/shared/infrastructure/http/auth.ts'
import { zodDetails } from '@/modules/shared/infrastructure/schemas/respond.ts'
import {
  coachingPreferencesSchema,
  pushSubscriptionSchema,
} from '@/modules/athlete/infrastructure/schemas/preferences.ts'

/** Standalone mongod (no replica set) rejects transactions this way. */
function isUnsupportedTransaction(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null | undefined
  const msg = String(e?.message ?? '')
  return (
    e?.code === 20 ||
    /transaction numbers are only allowed on a replica set member or mongos/i.test(msg) ||
    /Transaction numbers are only allowed/i.test(msg)
  )
}
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { eraseAccount } from '@/modules/athlete/application/erase-account.service.ts'

const router = Router()

const preferenceWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const PREFERENCE_DEFAULTS = {
  explanations: true,
  sessionReminder: false,
  weeklySummary: false,
  locale: 'en' as const,
}

type StoredCoaching = Partial<{
  explanations: boolean
  sessionReminder: boolean
  weeklySummary: boolean
  locale: 'en' | 'pt'
}>

/** The idempotency fields stay server-side; the client sees only its switches. */
function preferencesPayload(coaching: StoredCoaching | null | undefined) {
  return {
    explanations: coaching?.explanations ?? PREFERENCE_DEFAULTS.explanations,
    sessionReminder: coaching?.sessionReminder ?? PREFERENCE_DEFAULTS.sessionReminder,
    weeklySummary: coaching?.weeklySummary ?? PREFERENCE_DEFAULTS.weeklySummary,
    locale: coaching?.locale ?? PREFERENCE_DEFAULTS.locale,
  }
}

router.get('/', async (req, res) => {
  const { payload, athlete } = await getSession(req)
  if (!payload) return res.json({ user: null })

  // No DB record yet (e.g. pre-Mongo auth): fall back to token contents. Old
  // tokens with names still stub fine; new slim ones carry IDs only.
  if (!athlete) {
    if (payload.firstname || payload.lastname) {
      return res.json({ user: { firstname: payload.firstname || null, lastname: payload.lastname || null, profile: payload.profile || null } })
    }
    return res.json({ user: null })
  }

  const { firstname, lastname, profile, email } = athlete
  res.json({
    user: {
      id: String(athlete._id),
      firstname,
      lastname,
      profile,
      email,
      createdAt: athlete.createdAt ?? null,
    },
  })
})

router.get('/preferences', requireAuthForUserData, async (req, res, next) => {
  try {
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const athlete = await Athlete.findById(athleteId).select('preferences.coaching').lean()
    res.json(preferencesPayload(athlete?.preferences?.coaching))
  } catch (e) {
    next(e)
  }
})

router.put('/preferences', requireAuthForUserData, preferenceWriteLimiter, async (req, res, next) => {
  try {
    const parsed = coachingPreferencesSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid preferences', details: zodDetails(parsed.error) })
    }
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })

    const $set: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) $set[`preferences.coaching.${key}`] = value
    }
    if (!Object.keys($set).length) return res.status(400).json({ error: 'No preference supplied' })

    const athlete = await Athlete.findByIdAndUpdate(athleteId, { $set }, { new: true })
      .select('preferences.coaching')
      .lean()
    if (!athlete) return res.status(404).json({ error: 'No athlete' })
    res.json(preferencesPayload(athlete.preferences?.coaching))
  } catch (e) {
    next(e)
  }
})

router.post(
  '/push-subscriptions',
  requireAuthForUserData,
  preferenceWriteLimiter,
  async (req, res, next) => {
    try {
      const parsed = pushSubscriptionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid subscription', details: zodDetails(parsed.error) })
      }
      const athleteId = (await getSession(req)).athleteId
      if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })

      // One row per endpoint: re-subscribing on the same device replaces it,
      // and the array stays bounded so a user cannot grow it forever.
      await Athlete.updateOne(
        { _id: athleteId },
        { $pull: { pushSubscriptions: { endpoint: parsed.data.endpoint } } },
      )
      await Athlete.updateOne(
        { _id: athleteId },
        { $push: { pushSubscriptions: { $each: [parsed.data], $slice: -5 } } },
      )
      res.status(201).json({ ok: true })
    } catch (e) {
      next(e)
    }
  },
)

router.delete('/push-subscriptions', requireAuthForUserData, async (req, res, next) => {
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : ''
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' })
    const athleteId = (await getSession(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    await Athlete.updateOne({ _id: athleteId }, { $pull: { pushSubscriptions: { endpoint } } })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// GDPR erasure across every collection keyed by the athlete: all-or-nothing, or an
// ordered-delete fallback on standalone mongod; reports which path ran and clears the cookie.
router.delete('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const athleteId = (await getSession(req)).athleteId
  if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })

  const clearCookie = () => res.clearCookie('token', { ...sessionCookieOptions(), maxAge: undefined })

  const athlete = await Athlete.findById(athleteId).select('_id')
  if (!athlete) {
    clearCookie()
    return res.json({ ok: true, deleted: 0, atomic: false })
  }

  const erase = (session: ClientSession | undefined) => eraseAccount(athlete._id, session)

  let deleted = 0
  let atomic = false
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      deleted = await erase(session)
      atomic = true
    })
  } catch (err) {
    // Standalone mongod has no transactions: fall back rather than refuse the erasure.
    if (!isUnsupportedTransaction(err)) throw err
    deleted = await erase(undefined)
  } finally {
    await session.endSession()
  }

  clearCookie()
  res.json({ ok: true, deleted, atomic })
})

export default router
