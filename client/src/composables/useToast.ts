import { ref } from 'vue'

interface Toast {
  id: number
  message: unknown
  type: string
  icon?: unknown
  duration: number
  position: string
}

const toasts = ref<Toast[]>([])
let nextId = 1

const POSITION_CLASSES = {
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
}

export function useToast() {
  function show(message: unknown, opts: Record<string, unknown> = {}): number {
    const id = nextId++
    // Options arrive loosely typed from every call site; narrow once, here.
    const type = typeof opts.type === 'string' && opts.type ? opts.type : 'success'
    const duration = typeof opts.duration === 'number' ? opts.duration : 3500
    const position =
      typeof opts.position === 'string' && opts.position ? opts.position : 'top-right'
    const toast: Toast = {
      id,
      message,
      type, // success | error | warning | info
      icon: opts.icon, // override icon, else derived from type
      duration,
      position,
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
