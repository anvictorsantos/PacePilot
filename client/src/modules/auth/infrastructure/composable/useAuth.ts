import { computed } from 'vue'

import type { AuthSessionResponse } from '@/modules/auth/infrastructure/dto/AuthSessionResponse.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { useResource, resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

/**
 * The account session. One shared resource key so the router gate, the login
 * form and the connect screen agree on who is signed in without each calling
 * `/api/auth/session`.
 *
 * Connection state travels with it (`connections`) — the session is the account,
 * and each source grant is an attribute of it.
 */
const KEY = 'auth.session'

const EMPTY: AuthSessionResponse = {
  authenticated: false,
  user: null,
  connections: [],
  strava: { connected: false, promptSeen: false },
}

export function useAuth() {
  const { data, loading, error, settled, reload } = useResource<AuthSessionResponse>(
    KEY,
    () => api.auth.session(),
    { immediate: false },
  )

  const authenticated = computed(() => Boolean(data.value?.authenticated))
  const user = computed(() => data.value?.user ?? null)
  const strava = computed(() => data.value?.strava ?? EMPTY.strava)
  const connections = computed(() => data.value?.connections ?? [])
  /** True when at least one enabled source is linked. */
  const anyConnected = computed(
    () => connections.value.some((entry) => entry.connected) || strava.value.connected,
  )
  const emailVerified = computed(() => Boolean(data.value?.emailVerified))
  const { resetConnection } = useConnection()

  /** Read the session at most once per page load unless forced. */
  async function ensure(force = false): Promise<boolean> {
    if (settled.value && !force) return authenticated.value
    await reload(force)
    return authenticated.value
  }

  function apply(session: AuthSessionResponse): void {
    data.value = session
    settled.value = true
  }

  async function login(email: string, password: string): Promise<AuthSessionResponse> {
    const session = await api.auth.login({ email, password })
    resetConnection()
    apply(session)
    return session
  }

  async function register(email: string, password: string): Promise<AuthSessionResponse> {
    const session = await api.auth.register({ email, password })
    resetConnection()
    apply(session)
    return session
  }

  async function logout(): Promise<void> {
    await api.auth.logout()
    clear()
  }

  async function markStravaPromptSeen(): Promise<void> {
    if (strava.value.promptSeen) return
    await api.auth.markStravaPromptSeen()
    if (data.value) {
      data.value = { ...data.value, strava: { ...data.value.strava, promptSeen: true } }
    }
  }

  /** Update the Strava half without re-reading the whole session. */
  function setStravaConnected(connected: boolean): void {
    if (data.value) {
      data.value = { ...data.value, strava: { ...data.value.strava, connected } }
    }
  }

  function clear(): void {
    // The session is gone, so every read belongs to nobody: a hard clear, not an
    // invalidation, or the next account on this browser would see the previous
    // athlete's plan and progress until each read revalidated.
    resetResource()
    resetConnection()
  }

  return {
    authenticated,
    user,
    strava,
    connections,
    anyConnected,
    emailVerified,
    loading,
    error,
    settled,
    ensure,
    login,
    register,
    logout,
    markStravaPromptSeen,
    setStravaConnected,
    clear,
  }
}
