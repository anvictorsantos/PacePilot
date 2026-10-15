import * as Sentry from '@sentry/vue'

export type LogContext = {
  feature?: string
  operation?: string
  route?: string
  requestId?: string
  [key: string]: unknown
}

const reported = new WeakSet<object>()

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'secret',
  'api_key',
  'apikey',
])

function isDev(): boolean {
  return Boolean(import.meta.env.DEV)
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(typeof error === 'string' ? error : 'Unknown error')
}

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const scrubbed: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      scrubbed[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[Filtered]' : scrub(nested)
    }
    return scrubbed
  }
  return value
}

function consoleLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: LogContext): void {
  if (!isDev()) return
  const payload = context ? scrub(context) : undefined
  if (level === 'debug') console.debug(message, payload)
  if (level === 'info') console.info(message, payload)
  if (level === 'warn') console.warn(message, payload)
  if (level === 'error') console.error(message, payload)
}

export function debug(message: string, context?: LogContext): void {
  consoleLog('debug', message, context)
}

export function info(message: string, context?: LogContext): void {
  consoleLog('info', message, context)
}

export function warn(message: string, context?: LogContext): void {
  consoleLog('warn', message, context)
}

export function error(message: string, context?: LogContext): void {
  consoleLog('error', message, context)
}

export function captureException(error: unknown, context?: LogContext): string | undefined {
  const normalized = normalizeError(error)
  if (error && typeof error === 'object') {
    if (reported.has(error)) return undefined
    reported.add(error)
  }

  if (isDev()) consoleLog('error', normalized.message, context)
  const scopeContext = context ? scrub(context) : undefined
  return Sentry.captureException(normalized, {
    tags: {
      feature: context?.feature,
      operation: context?.operation,
    },
    extra: scopeContext as Record<string, unknown> | undefined,
  })
}

export function captureMessage(message: string, context?: LogContext): string | undefined {
  if (isDev()) consoleLog('info', message, context)
  const scopeContext = context ? scrub(context) : undefined
  return Sentry.captureMessage(message, {
    level: 'info',
    tags: {
      feature: context?.feature,
      operation: context?.operation,
    },
    extra: scopeContext as Record<string, unknown> | undefined,
  })
}


export function recordRecoveredError(error: unknown, context?: LogContext): void {
  if (import.meta.env.DEV && typeof console !== 'undefined') {
    console.debug('Ignored non-critical error:', error)
  }
  Sentry.addBreadcrumb({
    category: 'recovered-error',
    level: 'warning',
    message: error instanceof Error ? error.message : String(error),
    data: context ? (scrub(context) as Record<string, unknown>) : undefined,
  })
}
