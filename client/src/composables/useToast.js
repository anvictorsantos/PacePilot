import { ref } from 'vue'

const toasts = ref([])
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
  function show(message, opts = {}) {
    const id = nextId++
    const toast = {
      id,
      message,
      type: opts.type || 'success',   // success | error | warning | info
      icon: opts.icon,                 // override icon, else derived from type
      duration: opts.duration ?? 3500,
      position: opts.position || 'top-right',
    }
    toasts.value.push(toast)
    if (toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration)
    }
    return id
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, show, dismiss, POSITION_CLASSES }
}
