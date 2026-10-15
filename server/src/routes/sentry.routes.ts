import express from 'express'
import { env } from '../config/env.ts'

const router = express.Router()
const allowedHost = env.sentryIngestHost
const allowedProjectId = env.sentryProjectId

router.post('/tunnel', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    const envelope = typeof req.body === 'string' ? req.body : ''
    const firstLine = envelope.split('\n')[0]
    const header = firstLine ? JSON.parse(firstLine) : {}
    const parsed = new URL(header.dsn)
    const host = parsed.hostname
    const projectId = parsed.pathname.replace(/\//g, '')

    if (host !== allowedHost || projectId !== allowedProjectId || parsed.protocol !== 'https:') {
      return res.status(400).json({ status: 'invalid dsn' })
    }

    const upstreamUrl = `https://${host}/api/${projectId}/envelope/`
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      body: envelope,
      headers: { 'content-type': 'application/x-sentry-envelope' },
    })

    const responseText = await upstream.text()
    if (upstream.headers.get('content-type')) {
      res.setHeader('content-type', upstream.headers.get('content-type'))
    }
    return res.status(upstream.status).send(responseText)
  } catch (error) {
    console.warn('[sentry tunnel] failed:', error?.message)
    return res.status(400).json({ status: 'invalid request' })
  }
})

export default router
