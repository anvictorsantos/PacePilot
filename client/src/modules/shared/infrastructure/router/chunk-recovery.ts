/**
 * A route chunk that no longer exists.
 *
 * Views are lazy (one `import()` per route), so every deploy replaces the hashed
 * filenames. A browser that is still running the previous bundle — or that
 * received `index.html` from a cache while the assets were already replaced —
 * asks for a file that the CDN has deleted. The navigation dies and the athlete
 * sees a screen that never opens.
 *
 * Nothing here can resurrect the chunk: the current release is the only one on
 * the CDN. The recovery is to load the current `index.html`, which points at the
 * current chunks, and therefore to reload once.
 */

/** Each engine words it differently, and only the top-level message is stable. */
const CHUNK_LOAD_MESSAGES = [
  // Chrome, Edge, Firefox — a dynamic `import()` whose file is gone.
  'Failed to fetch dynamically imported module',
  // Firefox's `import()` variant.
  'error loading dynamically imported module',
  // Safari, including the entry-level `type="module"` failure it reports
  // instead of the two above (`PACEPILOT-CLIENT-A`).
  'Importing a module script failed',
]

/** True when this is a stale-deploy chunk failure rather than an app error. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return CHUNK_LOAD_MESSAGES.some((fragment) => message.includes(fragment))
}

/**
 * The reload we already performed, and when. A timestamp rather than a boolean
 * so a genuinely broken bundle cannot loop: the first reload is a recovery, the
 * next one within the window is a reload loop and must not happen.
 */
const RELOAD_AT_KEY = 'pacepilot:chunk-reload-at'

/** Long enough to cover a slow reload, short enough for the next deploy. */
const RELOAD_WINDOW_MS = 10_000

export interface ReloadDeps {
  /** `sessionStorage` in the browser; one reload per tab. */
  storage: Pick<Storage, 'getItem' | 'setItem'>
  /** Injected so the test never navigates. */
  reload: () => void
  now: () => number
}

export function reloadOnce(deps: Partial<ReloadDeps> = {}): boolean {
  const now = deps.now ?? (() => Date.now())
  const reload = deps.reload ?? (() => window.location.reload())
  // Resolved lazily, and only when not injected: the module is imported off the
  // browser too (unit tests, SSR-ish tooling) where `window` does not exist.
  const storage = deps.storage ?? window.sessionStorage
  let previous: number | null = null
  try {
    const raw = storage.getItem(RELOAD_AT_KEY)
    previous = raw === null ? null : Number(raw)
  } catch {
    // Private mode, storage disabled: recover anyway, the guard is best-effort.
    previous = null
  }
  const at = now()
  if (previous !== null && Number.isFinite(previous) && at - previous < RELOAD_WINDOW_MS) {
    return false
  }
  try {
    storage.setItem(RELOAD_AT_KEY, String(at))
  } catch {
    // Same as above: the reload still beats a dead navigation.
  }
  reload()
  return true
}

export interface PreloadErrorDeps {
  /** Where the payload goes — observability lives in the caller. */
  report: (payload: unknown) => void
  /** What to do about it; the caller decides the timing. */
  reload: () => void
}

/**
 * Vite's `vite:preloadError` handler: a module the document preloaded from the
 * previous release is gone. This is the entry-level twin of a route chunk, and
 * the shape iOS Safari reports as `Importing a module script failed`
 * (PACEPILOT-CLIENT-A) — the one failure the router never sees, because it
 * happens around the entry module rather than during a navigation.
 *
 * `preventDefault` stops Vite rethrowing it into the console; the report keeps
 * the rate visible; the reload is the recovery.
 */
export function onModulePreloadError(event: Event, deps: PreloadErrorDeps): void {
  event.preventDefault()
  // Vite's event carries the failure on `payload`, not on `detail`.
  const payload = (event as Event & { payload?: unknown }).payload
  deps.report(payload ?? new Error('Module preload failed'))
  deps.reload()
}
