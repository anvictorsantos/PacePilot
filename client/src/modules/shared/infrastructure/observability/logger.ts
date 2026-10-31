export type LogContext = {
  feature?: string
  operation?: string
  route?: string
  requestId?: string
  [key: string]: unknown
}

// No static SDK import: it would drag Sentry onto the critical path. `main.ts`
// loads it after first paint, so events are buffered and replayed into the sink.
type ExceptionOptions = {
  tags: { feature: string | undefined; operation: string | undefined }
  extra?: Record<string, unknown>
}

type MessageOptions = {
  tags: { feature: string | undefined; operation: string | undefined }
  extra?: Record<string, unknown>
}

type RecoveredBreadcrumb = {
  category: string
  level: 'warning'
  message: string
  data?: Record<string, unknown>
}

export type ObservabilitySink = {
  captureException: (error: Error, options: ExceptionOptions) => string | undefined
  captureMessage: (message: string, options: MessageOptions) => string | undefined
  addBreadcrumb: (breadcrumb: RecoveredBreadcrumb) => void
}

const PENDING_LIMIT = 50

type PendingEvent =
  | { kind: 'exception'; error: Error; options: ExceptionOptions }
  | { kind: 'message'; message: string; options: MessageOptions }
  | { kind: 'breadcrumb'; breadcrumb: RecoveredBreadcrumb }

let sink: ObservabilitySink | null = null
const pending: PendingEvent[] = []
let droppedEvents = 0

const enqueue = (event: PendingEvent): void => {
  if (pending.length >= PENDING_LIMIT) {
    pending.shift()
    droppedEvents += 1
  }
  pending.push(event)
}

export function setObservabilitySink(next: ObservabilitySink | null): void {
  sink = next
  if (!next) return
  const dropped = droppedEvents
  droppedEvents = 0
  for (const event of pending.splice(0)) {
    if (event.kind === 'exception') next.captureException(event.error, event.options)
    else if (event.kind === 'message') next.captureMessage(event.message, event.options)
    else next.addBreadcrumb(event.breadcrumb)
  }
  // Silence would look like a clean boot. Say how many events the cap cost.
  if (dropped > 0) {
    next.captureMessage(`Dropped ${dropped} buffered events before the error sink attached`, {
      tags: { feature: 'observability', operation: 'buffer-overflow' },
    })
  }
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

function consoleLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext,
): void {
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
  const options: ExceptionOptions = {
    tags: {
      feature: context?.feature,
      operation: context?.operation,
    },
    // `exactOptionalPropertyTypes` rejects an explicit `undefined`; Sentry treats
    // the two the same.
    ...(scopeContext !== undefined ? { extra: scopeContext as Record<string, unknown> } : {}),
  }

  if (!sink) {
    enqueue({ kind: 'exception', error: normalized, options })
    return undefined
  }
  return sink.captureException(normalized, options)
}

export function captureMessage(message: string, context?: LogContext): string | undefined {
  if (isDev()) consoleLog('info', message, context)
  const scopeContext = context ? scrub(context) : undefined
  const options: MessageOptions = {
    tags: {
      feature: context?.feature,
      operation: context?.operation,
    },
    ...(scopeContext !== undefined ? { extra: scopeContext as Record<string, unknown> } : {}),
  }

  if (!sink) {
    enqueue({ kind: 'message', message, options })
    return undefined
  }
  return sink.captureMessage(message, options)
}

export function recordRecoveredError(error: unknown, context?: LogContext): void {
  if (import.meta.env.DEV && typeof console !== 'undefined') {
    console.debug('Ignored non-critical error:', error)
  }
  const breadcrumb: RecoveredBreadcrumb = {
    category: 'recovered-error',
    level: 'warning',
    message: error instanceof Error ? error.message : String(error),
    ...(context ? { data: scrub(context) as Record<string, unknown> } : {}),
  }

  if (!sink) {
    enqueue({ kind: 'breadcrumb', breadcrumb })
    return
  }
  sink.addBreadcrumb(breadcrumb)
}
