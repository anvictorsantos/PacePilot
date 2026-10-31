// Views are lazy, so every deploy replaces the hashed filenames. A tab still
// running the previous bundle asks for a file the CDN has deleted; the only
// recovery is reloading into the current index.html.

// Each engine words it differently, and only the top-level message is stable.
const CHUNK_LOAD_MESSAGES = [
  // Chrome, Edge, Firefox.
  'Failed to fetch dynamically imported module',
  // Firefox's `import()` variant.
  'error loading dynamically imported module',
  // Safari, including the entry-level failure it reports instead (PACEPILOT-CLIENT-A).
  'Importing a module script failed',
]

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return CHUNK_LOAD_MESSAGES.some((fragment) => message.includes(fragment))
}

// A timestamp, not a boolean: a genuinely broken bundle must not reload-loop.
const RELOAD_AT_KEY = 'pacepilot:chunk-reload-at'

// Long enough to cover a slow reload, short enough for the next deploy.
const RELOAD_WINDOW_MS = 10_000

export interface ReloadDeps {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  reload: () => void
  now: () => number
}

export function reloadOnce(deps: Partial<ReloadDeps> = {}): boolean {
  const now = deps.now ?? (() => Date.now())
  const reload = deps.reload ?? (() => window.location.reload())
  // Resolved lazily: the module is imported in tests where `window` does not exist.
  const storage = deps.storage ?? window.sessionStorage
  let previous: number | null = null
  try {
    const raw = storage.getItem(RELOAD_AT_KEY)
    previous = raw === null ? null : Number(raw)
  } catch {
    // Private mode or storage disabled: recover anyway, the guard is best-effort.
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
  report: (payload: unknown) => void
  reload: () => void
}

// Vite's entry-level twin of a route chunk; `preventDefault` stops the rethrow.
export function onModulePreloadError(event: Event, deps: PreloadErrorDeps): void {
  event.preventDefault()
  // Vite's event carries the failure on `payload`, not on `detail`.
  const payload = (event as Event & { payload?: unknown }).payload
  deps.report(payload ?? new Error('Module preload failed'))
  deps.reload()
}
