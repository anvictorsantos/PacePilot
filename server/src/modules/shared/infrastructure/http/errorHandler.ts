import type { NextFunction, Request, Response } from 'express'
import { redactSecrets } from '@/modules/shared/infrastructure/utils/redact.ts'
import { isAppError } from '@/modules/shared/infrastructure/errors/AppError.ts'

// Express hands `err` in as `any`; this narrows it to the fields the handler reads (and
// keeps `isAppError`'s type predicate valid against it).
interface RequestError {
  name?: string
  message?: string
  stack?: string
  code?: string | null
  type?: string
  status?: number
  statusCode?: number
}

// Single error boundary, and the only place a failure is logged: per-route logging
// produced duplicate lines for the same failure.
export function errorHandler(err: RequestError, _req: Request, res: Response, _next: NextFunction) {
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

  // body-parser's message embeds the runtime parser wording and byte offsets.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed request' })
  }

  if (status >= 500) {
    // Never leak internals on a server fault, including AppError 5xx messages.
    return res.status(status).json({ error: 'Internal server error' })
  }

  // 4xx: only messages explicitly marked exposable reach the client, scrubbed and
  // length-capped so DB/Strava internals can never ride along.
  const raw =
    isAppError(err) && err.expose && err.message
      ? err.message
      : typeof err?.message === 'string' && err.message
        ? err.message
        : 'Request failed'
  res.status(status).json({ error: redactSecrets(raw).slice(0, 300) })
}

function resolveStatus(err: RequestError): number {
  if (isAppError(err)) return err.status
  // cors allowlist denial carries no status — surface as 403, not 500.
  if (err?.message === 'CORS origin denied') return 403
  const s = err?.status ?? err?.statusCode
  return typeof s === 'number' && s >= 400 && s <= 599 ? s : 500
}

function isClientNoise(err: RequestError): boolean {
  return (
    err?.code === 'ECONNABORTED' ||
    // A malformed or oversized body is the caller's mistake, not a server fault:
    // body-parser's 400/413 already answers, and a stack here is log noise.
    err?.type === 'entity.parse.failed' ||
    err?.type === 'entity.too.large'
  )
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' })
}
