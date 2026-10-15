import { Router } from 'express'
import mongoose from 'mongoose'
import { Athlete } from '../models/Athlete.ts'
import { Waitlist } from '../models/Waitlist.ts'

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
  const used = await Athlete.countDocuments({ strava_athlete_id: { $ne: null } })
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
    if (err?.code === 11000) return res.json({ ok: true, already: true })
    throw err
  }
  res.json({ ok: true })
})

export default router
