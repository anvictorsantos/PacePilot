import { onUnmounted, ref } from 'vue'

import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'

export type ProviderConnectStatus = 'idle' | 'waiting' | 'connected' | 'error'

const POLL_MS = 1500
const TIMEOUT_MS = 3 * 60 * 1000

/**
 * Strava linking without leaving the app.
 *
 * Strava has to render its own consent page, so it opens in a child window;
 * this composable never navigates the SPA. The callback page closes itself and
 * the SPA notices through a status poll (and a same-origin message when the
 * browser keeps the opener), then the modal can show the result.
 */
export function useProviderConnect(providerId = 'strava') {
  const status = ref<ProviderConnectStatus>('idle')
  const errorCode = ref('')
  const { checkStatus, setConnected } = useConnection()
  const { setStravaConnected, ensure } = useAuth()

  let popup: Window | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false

  function stopTimers(): void {
    if (pollTimer) clearInterval(pollTimer)
    if (deadlineTimer) clearTimeout(deadlineTimer)
    pollTimer = null
    deadlineTimer = null
  }

  function stop(): void {
    stopTimers()
    window.removeEventListener('message', onMessage)
  }

  function closePopup(): void {
    try {
      if (popup && !popup.closed) popup.close()
    } catch {
      // Cross-origin close is not needed: the callback window closes itself.
    }
    popup = null
  }

  function succeed(): void {
    if (status.value === 'connected') return
    stop()
    status.value = 'connected'
    errorCode.value = ''
    setConnected(true)
    setStravaConnected(true)
    // Refresh the account session so the link prompt reflects the connection.
    void ensure(true)
    setTimeout(closePopup, 100)
  }

  function fail(code = 'connection_failed'): void {
    if (status.value === 'connected') return
    stop()
    status.value = 'error'
    errorCode.value = code
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== window.location.origin) return
    const data = event.data as { type?: unknown; status?: unknown; code?: unknown } | null
    if (!data || data.type !== 'pacepilot:connection') return
    if (data.status === 'connected') succeed()
    else fail(typeof data.code === 'string' ? data.code : 'connection_failed')
  }

  async function poll(): Promise<void> {
    if (inFlight || status.value !== 'waiting') return
    inFlight = true
    try {
      if (await checkStatus(true)) {
        succeed()
        return
      }
      // The Strava window closed without linking (consent dismissed or the
      // callback errored). One final read already ran above.
      if (popup?.closed) fail('cancelled')
    } catch {
      // Offline or a transient 5xx: the next tick retries.
    } finally {
      inFlight = false
    }
  }

  /** Must be called synchronously from a click so the browser allows the popup. */
  function connect(next = '/workout', provider = providerId): void {
    cancel(false)
    status.value = 'waiting'
    errorCode.value = ''
    const url = `/api/providers/${encodeURIComponent(provider)}/authorize?popup=1&next=${encodeURIComponent(next)}`
    popup = window.open(url, `pacepilot-${provider}`, 'popup=yes,width=520,height=720')
    if (!popup) {
      status.value = 'error'
      errorCode.value = 'popup_blocked'
      return
    }
    window.addEventListener('message', onMessage)
    pollTimer = setInterval(() => void poll(), POLL_MS)
    deadlineTimer = setTimeout(() => {
      if (status.value === 'waiting') fail('timeout')
    }, TIMEOUT_MS)
  }

  /** Close the dialog: stop polling and abandon a half-finished popup. */
  function cancel(closeWindow = true): void {
    stop()
    if (closeWindow) closePopup()
    if (status.value !== 'connected') {
      status.value = 'idle'
      errorCode.value = ''
    }
  }

  onUnmounted(() => cancel(true))

  return { status, errorCode, connect, cancel }
}
