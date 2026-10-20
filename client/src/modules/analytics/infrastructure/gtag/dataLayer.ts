import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

/**
 * The `gtag` global and the queue behind it.
 *
 * `gtag` is not an import: the library itself comes from googletagmanager.com, so
 * this file owns the only `window` access in the module and the types that
 * describe it. Until the script arrives, `gtag` is a stub pushing
 * `arguments`-shaped entries onto `dataLayer`, which is also how the script is
 * handed everything queued before it loaded.
 */
type GtagCommand = (...args: unknown[]) => void

/**
 * The shape gtag.js reads. Not `unknown[]`: the tag walks the queue looking for
 * `arguments` objects and ignores a plain array *silently* — no error, no hit,
 * no network call — so the queue would look correct in `dataLayer` and send
 * nothing. This is a wire contract that cannot be inferred from the values.
 */
type GtagEntry = ArrayLike<unknown>

declare global {
  interface Window {
    dataLayer?: GtagEntry[]
    gtag?: GtagCommand
  }
}

const SCRIPT_ID = 'ga4-gtag'

/**
 * Wrap a command in the `arguments` object the official snippet pushes.
 * `gtag()` never queues the rest array itself, for the reason above.
 */
function toEntry(...values: unknown[]): GtagEntry {
  // The rest parameter only gives the call site a variadic signature; the entry
  // that must reach the queue is this function's own `arguments` object.
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

/** Queue one command. `installGtagStub` is idempotent and always runs first. */
export function gtag(...args: unknown[]): void {
  installGtagStub()
  window.gtag?.(...args)
}

/**
 * Fetch the tag. Left async and unawaited: the queue holds the commands, and
 * blocking a first paint on a third-party host would trade the wrong thing.
 */
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
