/**
 * A toast that has to survive a page reload: disconnecting a provider ends in
 * `window.location.reload()`, which destroys an in-memory toast. Parked in
 * sessionStorage (same tab, cleared with it) and consumed once on next boot.
 */
import { ToastPosition, ToastType } from '@/modules/shared/ui/useToast.ts'

export interface PendingToast {
  type: ToastType
  message: string
  position?: ToastPosition
}

const STORAGE_KEY = 'pacepilot.pending-toast'

/** sessionStorage, or null when there is none or touching it throws (Safari
 *  private mode). */
function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** Best-effort: a storage failure must never break the action that triggered it. */
export function queuePendingToast(toast: PendingToast): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(toast))
  } catch {
    // Quota or a locked-down browser: the action still succeeds, silently.
  }
}

/** Read and remove; null when there is none or the payload is not ours. */
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
