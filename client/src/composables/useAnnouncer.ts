import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const announcer = ref<HTMLDivElement | null>(null)

function ensureAnnouncer() {
  if (announcer.value) return announcer.value

  let el = document.getElementById('a11y-announcer')
  if (!el) {
    el = document.createElement('div')
    el.id = 'a11y-announcer'
    el.setAttribute('role', 'region')
    el.setAttribute('aria-live', 'polite')
    el.setAttribute('aria-atomic', 'true')
    el.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;'
    document.body.appendChild(el)
  }
  announcer.value = el
  return el
}

export function useAnnouncer() {
  onMounted(() => ensureAnnouncer())

  function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const el = ensureAnnouncer()
    el.setAttribute('aria-live', priority)
    el.textContent = ''
    nextTick(() => {
      el.textContent = message
    })
  }

  function polite(message: string) {
    announce(message, 'polite')
  }

  function assertive(message: string) {
    announce(message, 'assertive')
  }

  return { announce, polite, assertive }
}

export function useToastAnnouncer() {
  const { announce, polite, assertive } = useAnnouncer()

  function success(message: string) {
    polite(message)
  }

  function error(message: string) {
    assertive(message)
  }

  function warning(message: string) {
    assertive(message)
  }

  function info(message: string) {
    polite(message)
  }

  return { success, error, warning, info }
}