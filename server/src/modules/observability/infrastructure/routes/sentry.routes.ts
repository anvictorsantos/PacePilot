import express from 'express'
import { env } from '@/modules/shared/infrastructure/config/env.ts'

const router = express.Router()
const UPSTREAM_TIMEOUT_MS = 5000
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
    // Bounded: this tunnel runs inside a request handler. An upstream hang
    // used to hold the instance open until the platform killed it.
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      body: envelope,
      headers: { 'content-type': 'application/x-sentry-envelope' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    const responseText = await upstream.text()
    const contentType = upstream.headers.get('content-type')
    if (contentType) {
      res.setHeader('content-type', contentType)
    }
    return res.status(upstream.status).send(responseText)
  } catch (error) {
    // A malformed envelope is the caller's fault (400); a timeout or a 5xx from
    // Sentry is ours to report honestly, not laundered into "invalid request".
    // `error` is `unknown`; read `name`/`message` through a defensive shape.
    const err = error as { name?: string; message?: string } | null
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      console.warn('[sentry tunnel] upstream timeout after', UPSTREAM_TIMEOUT_MS, 'ms')
      return res.status(504).json({ status: 'upstream timeout' })
    }
    if (error instanceof TypeError || err?.name === 'SyntaxError') {
      return res.status(400).json({ status: 'invalid request' })
    }
    console.warn('[sentry tunnel] upstream failed:', err?.message)
    return res.status(502).json({ status: 'upstream error' })
  }
})

export default router
