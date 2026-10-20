import { Router } from 'express'
import mongoose from 'mongoose'
import { Athlete, CONNECTED_ATHLETE_FILTER } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { Waitlist } from '@/modules/waitlist/infrastructure/persistence/Waitlist.ts'

const router = Router()

function athleteLimit() {
  const n = parseInt(process.env.STRAVA_ATHLETE_LIMIT || '10', 10)
  return Number.isFinite(n) && n > 0 ? n : 10
}

// Public: how many athlete slots are used. Powers the landing/login
// capacity notice + waitlist switch. Strava exposes no quota API, so our
// own athlete count is the source of truth.
router.get('/capacity', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({ limit: athleteLimit(), used: 0, full: false, unknown: true })
  }
  // Connected = still holds a Strava grant. Logged-out athletes keep their slot;
  // a disconnect frees it without deleting the training history.
  const used = await Athlete.countDocuments(CONNECTED_ATHLETE_FILTER)
  const limit = athleteLimit()
  res.json({ limit, used, full: used >= limit })
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Public: join the waitlist when athlete slots are full.
router.post('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected — check MONGODB_URI' })
  }
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254)
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email required' })
  try {
    await Waitlist.create({ email })
  } catch (err) {
    // Mongo duplicate-key error on the unique email index.
    if ((err as { code?: unknown } | null)?.code === 11000) return res.json({ ok: true, already: true })
    throw err
  }
  res.json({ ok: true })
})

export default router
