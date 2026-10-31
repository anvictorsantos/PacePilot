// A dialog module — focus trap, Escape, body scroll lock and focus restore behind one call.
import { computed, nextTick, onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface DialogOptions {
  active: Ref<boolean>
  /** id of the element that names the dialog. */
  labelledby?: string
  /** Fallback accessible name when there is no title element to point at. */
  label?: string
  onEscape?: () => void
  initialFocus?: Ref<HTMLElement | null>
}

export interface Dialog {
  /** `role` / `aria-modal` / name — spread onto the dialog element. */
  attrs: ComputedRef<Record<string, string>>
  getFocusableElements(): HTMLElement[]
}

export function useDialog(container: Ref<HTMLElement | null>, options: DialogOptions): Dialog {
  const { active, labelledby, label, onEscape, initialFocus } = options
  let lastFocused: HTMLElement | null = null
  let holdsScrollLock = false
  let opened = false

  function getFocusableElements(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    )
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      onEscape?.()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = getFocusableElements()
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function open(): void {
    opened = true
    lastFocused = document.activeElement as HTMLElement | null
    // The first dialog to open owns the scroll lock, so a nested one cannot
    // unlock the page behind it.
    if (!holdsScrollLock) {
      document.body.style.overflow = 'hidden'
      holdsScrollLock = true
    }
    document.addEventListener('keydown', onKeydown)
    void nextTick(() => {
      const target = initialFocus?.value ?? getFocusableElements()[0] ?? null
      target?.focus()
    })
  }

  function close(): void {
    document.removeEventListener('keydown', onKeydown)
    if (holdsScrollLock) {
      document.body.style.overflow = ''
      holdsScrollLock = false
    }
    lastFocused?.focus()
    lastFocused = null
  }

  watch(
    active,
    (isOpen) => {
      if (isOpen) open()
      else if (opened) close()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (active.value) close()
  })

  const attrs = computed(() => ({
    role: 'dialog',
    'aria-modal': 'true',
    ...(labelledby ? { 'aria-labelledby': labelledby } : {}),
    ...(label ? { 'aria-label': label } : {}),
  }))

  return { attrs, getFocusableElements }
}
