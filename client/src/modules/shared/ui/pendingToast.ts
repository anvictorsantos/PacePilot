/**
 * A toast that has to survive a page reload.
 *
 * Some actions end with `window.location.reload()` — disconnecting a provider is
 * the case that matters: the whole app has to re-read the account from the
 * server, and an in-memory toast would be destroyed by that reload. The outcome
 * is parked in sessionStorage (same tab, cleared with it) and consumed once on
 * the next boot.
 *
 * Nothing secret goes in here: only a message the UI was about to render and its
 * type. A payload that fails validation is dropped rather than rendered.
 */
import { ToastPosition, ToastType } from '@/modules/shared/ui/useToast.ts'

export interface PendingToast {
  type: ToastType
  message: string
  position?: ToastPosition
}

const STORAGE_KEY = 'pacepilot.pending-toast'

/** sessionStorage, or null when the environment has none (SSR, node tests,
 *  Safari private mode where touching it throws). */
function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** Park one toast for the next boot. Best-effort: a storage failure must never
 *  break the action that triggered it. */
export function queuePendingToast(toast: PendingToast): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(toast))
  } catch {
    // Quota or a locked-down browser: the action still succeeds, just silently.
  }
}

/** Read and remove the parked toast. Returns null when there is none or the
 *  payload is not something this module wrote. */
export function consumePendingToast(): PendingToast | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return null
    store.removeItem(STORAGE_KEY)
    return parsePendingToast(raw)
  } catch {
    return null
  }
}

function parsePendingToast(raw: string): PendingToast | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.message !== 'string' || !candidate.message) return null
  if (!isToastType(candidate.type)) return null
  const toast: PendingToast = { type: candidate.type, message: candidate.message }
  if (isToastPosition(candidate.position)) toast.position = candidate.position
  return toast
}

function isToastType(value: unknown): value is ToastType {
  return typeof value === 'string' && (Object.values(ToastType) as string[]).includes(value)
}

function isToastPosition(value: unknown): value is ToastPosition {
  return typeof value === 'string' && (Object.values(ToastPosition) as string[]).includes(value)
}
