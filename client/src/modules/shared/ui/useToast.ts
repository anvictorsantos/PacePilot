import { ref } from 'vue'

/** What a toast is telling the athlete. Drives the icon and the live region. */
export enum ToastType {
  Success = 'success',
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

export enum ToastPosition {
  TopRight = 'top-right',
  TopLeft = 'top-left',
  TopCenter = 'top-center',
  BottomRight = 'bottom-right',
  BottomLeft = 'bottom-left',
  BottomCenter = 'bottom-center',
}

export interface ToastOptions {
  type?: ToastType
  /** Override the icon; otherwise it is derived from the type. */
  icon?: unknown
  /** Milliseconds on screen; `0` keeps it until dismissed. */
  duration?: number
  position?: ToastPosition
}

interface Toast {
  id: number
  message: unknown
  type: ToastType
  icon?: unknown
  duration: number
  position: ToastPosition
}

const toasts = ref<Toast[]>([])
let nextId = 1

const DEFAULT_DURATION_MS = 3500

const POSITION_CLASSES: Record<ToastPosition, string> = {
  [ToastPosition.TopRight]: 'top-4 right-4 items-end',
  [ToastPosition.TopLeft]: 'top-4 left-4 items-start',
  [ToastPosition.TopCenter]: 'top-4 left-1/2 -translate-x-1/2 items-center',
  [ToastPosition.BottomRight]: 'bottom-4 right-4 items-end',
  [ToastPosition.BottomLeft]: 'bottom-4 left-4 items-start',
  [ToastPosition.BottomCenter]: 'bottom-4 left-1/2 -translate-x-1/2 items-center',
}

export function useToast() {
  function show(message: unknown, opts: ToastOptions = {}): number {
    const id = nextId++
    const toast: Toast = {
      id,
      message,
      type: opts.type ?? ToastType.Success,
      icon: opts.icon,
      duration: opts.duration ?? DEFAULT_DURATION_MS,
      position: opts.position ?? ToastPosition.TopRight,
    }
    toasts.value.push(toast)
    if (toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration)
    }
    return id
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, show, dismiss, POSITION_CLASSES }
}
