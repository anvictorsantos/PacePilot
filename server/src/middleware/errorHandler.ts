import { redactSecrets } from '../utils/redact.ts'

export function errorHandler(err, _req, res, _next) {
  console.error('[error]', redactSecrets(err?.message))
  // cors allowlist denial carries no status — surface as 403, not 500.
  const status = err?.message === 'CORS origin denied' ? 403 : err?.status || err?.statusCode || 500
  if (status >= 500) return res.status(status).json({ error: 'Internal server error' })
  // 4xx: scrub secrets + cap length so DB/Strava internals never reach client.
  const raw = typeof err?.message === 'string' && err.message ? err.message : 'Request failed'
  res.status(status).json({ error: redactSecrets(raw).slice(0, 300) })
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' })
}
