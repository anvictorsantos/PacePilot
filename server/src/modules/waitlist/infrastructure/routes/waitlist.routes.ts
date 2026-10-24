import { Router } from 'express'
import mongoose from 'mongoose'
import { Waitlist } from '@/modules/waitlist/infrastructure/persistence/Waitlist.ts'
import {
  athleteLimit,
  connectedCount,
} from '@/modules/providers/application/connection.service.ts'

const router = Router()

// Public: how many athlete slots are used. Powers the landing/login
// capacity notice + waitlist switch. Providers expose no shared quota API, so
// our own live connection count is the source of truth.
router.get('/capacity', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({ limit: await athleteLimit(), used: 0, full: false, unknown: true })
  }
  const [used, limit] = await Promise.all([connectedCount(), athleteLimit()])
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
