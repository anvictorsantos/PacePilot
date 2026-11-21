import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { runNotificationTick } from '@/modules/notifications/application/notifications.service.ts'

const router = Router()

function secretMatches(value: string | undefined): boolean {
  if (!env.cronSecret || !value) return false
  const provided = Buffer.from(value)
  const expected = Buffer.from(env.cronSecret)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

/** Scheduler-only: an hourly pass over opted-in athletes. */
router.post('/tick', async (req, res, next) => {
  try {
    if (!env.cronSecret) return res.status(503).json({ error: 'CRON_SECRET not configured' })
    const header = req.headers.authorization
    const provided = typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined
    if (!secretMatches(provided)) return res.status(401).json({ error: 'Unauthorized' })

    const result = await runNotificationTick()
    res.json(result)
  } catch (e) {
    next(e)
  }
})

export default router
