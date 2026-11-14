import { Router } from 'express'
import mongoose, { type ClientSession } from 'mongoose'
import { getSession, sessionCookieOptions } from '@/modules/athlete/application/session.service.ts'

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
  res.json({ user: { firstname, lastname, profile, email } })
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
