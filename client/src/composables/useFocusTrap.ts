import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  options: { active?: Ref<boolean>; onEscape?: () => void } = {},
) {
  const { active = ref(true), onEscape } = options
  let lastFocusedElement: HTMLElement | null = null

  function getFocusableElements(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(
      containerRef.value.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
  }

  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab') return

    const focusable = getFocusableElements()
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && onEscape) {
      onEscape()
    }
    trapFocus(e)
  }

  function activate() {
    lastFocusedElement = document.activeElement as HTMLElement
    nextTick(() => {
      const focusable = getFocusableElements()
      if (focusable.length) focusable[0].focus()
    })
    document.addEventListener('keydown', handleKeydown)
  }

  function deactivate() {
    document.removeEventListener('keydown', handleKeydown)
    if (lastFocusedElement) {
      lastFocusedElement.focus()
      lastFocusedElement = null
    }
  }

  watch(active, (v) => {
    if (v) activate()
    else deactivate()
  })

  onMounted(() => {
    if (active.value) activate()
  })

  onBeforeUnmount(() => deactivate())

  return { activate, deactivate, getFocusableElements }
}
