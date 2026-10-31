import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

// `gtag` comes from googletagmanager.com, not an import: this file owns the only
// `window` access in the module and the stub that queues calls until it loads.
type GtagCommand = (...args: unknown[]) => void

// gtag.js only recognises `arguments` objects in the queue and silently ignores a
// plain array: no error, no hit, no network call.
type GtagEntry = ArrayLike<unknown>

declare global {
  interface Window {
    dataLayer?: GtagEntry[]
    gtag?: GtagCommand
  }
}

const SCRIPT_ID = 'ga4-gtag'

function toEntry(...values: unknown[]): GtagEntry {
  // `values` only gives the call site a variadic signature; the queue needs this function's `arguments`.
  void values
  return arguments
}

function push(entry: GtagEntry): void {
  try {
    const queue = (window.dataLayer = window.dataLayer || [])
    queue.push(entry)
  } catch (error) {
    recordRecoveredError(error, { feature: 'analytics', operation: 'data-layer-push' })
  }
}

/** Define the stub before the first command is queued, so nothing is dropped. */
export function installGtagStub(): void {
  if (typeof window.gtag === 'function') return
  window.gtag = (...args: unknown[]) => push(toEntry(...args))
}

/** Queue one command; the stub is installed first and is idempotent. */
export function gtag(...args: unknown[]): void {
  installGtagStub()
  window.gtag?.(...args)
}

// Async and unawaited on purpose: the queue holds the commands, and blocking first
// paint on a third-party host would trade the wrong thing.
export function loadGtagScript(measurementId: string): void {
  try {
    if (document.getElementById(SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    document.head.appendChild(script)
  } catch (error) {
    recordRecoveredError(error, { feature: 'analytics', operation: 'load-script' })
  }
}
