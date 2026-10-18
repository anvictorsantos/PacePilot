import { redactSecrets } from '@/modules/shared/infrastructure/utils/redact.ts'
import { isAppError } from '@/modules/shared/infrastructure/errors/AppError.ts'

/**
 * Single error boundary. Everything funnels here via `next(err)`.
 *
 * Logging happens ONCE, here, not at every throw site — routes that also logged
 * produced duplicate lines for the same failure.
 */
export function errorHandler(err, _req, res, _next) {
  const status = resolveStatus(err)

  // Client disconnects and malformed JSON bodies are routine, not faults, and
  // are dropped rather than logged. Checked before the status test because an
  // aborted request carries no status and would otherwise look like a 500.
  if (!isClientNoise(err)) {
    const where = `${err?.name ?? 'Error'}${status !== 500 ? ` (${status})` : ''}`
    const stack = err?.stack ? `\n${err.stack}` : ''
    // One composed line: a multi-argument console.error splits in most log
    // shippers and makes the message hard to search.
    console.error(`[error] ${where}: ${redactSecrets(err?.message)}${stack}`)
  }

  if (res.headersSent) return res.end()

  if (status >= 500) {
    // Never leak internals on a server fault, including AppError 5xx messages.
    return res.status(status).json({ error: 'Internal server error' })
  }

  // 4xx: only messages explicitly marked exposable reach the client, scrubbed
  // and length-capped so DB/Strava internals can never ride along.
  const raw =
    isAppError(err) && err.expose && err.message
      ? err.message
      : typeof err?.message === 'string' && err.message
        ? err.message
        : 'Request failed'
  res.status(status).json({ error: redactSecrets(raw).slice(0, 300) })
}

function resolveStatus(err): number {
  if (isAppError(err)) return err.status
  // cors allowlist denial carries no status — surface as 403, not 500.
  if (err?.message === 'CORS origin denied') return 403
  const s = err?.status ?? err?.statusCode
  return typeof s === 'number' && s >= 400 && s <= 599 ? s : 500
}

function isClientNoise(err): boolean {
  return err?.code === 'ECONNABORTED' || err?.type === 'entity.parse.failed'
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' })
}
