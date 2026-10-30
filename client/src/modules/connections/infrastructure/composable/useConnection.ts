import { computed } from 'vue'

import { autoSyncGate } from '@/modules/connections/infrastructure/composable/auto-sync-gate.ts'
import type { ConnectionStatus } from '@/modules/connections/infrastructure/dto/ConnectionStatus.ts'
import {
  resetResource,
  supersedeResource,
  useResource,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * Connection state has one owner: the `connection.status` resource.
 *
 * The header avatar, the feed panel notice and the sync action are all derived
 * from this one entry, so a link or a disconnect moves the three together and
 * no local flag can hold a stale answer of its own. `setConnected` is a write
 * into that entry, not a parallel source: it shows the answer the app just
 * learned and then forces a server read, which wins if the two disagree.
 */
const KEY = RESOURCE_KEYS.connectionStatus

export function useConnection() {
  const { data, settled, reload } = useResource<ConnectionStatus>(
    KEY,
    () => api.providers.status(),
    {
      immediate: false,
    },
  )

  const connected = computed(() => Boolean(data.value?.connected))
  const lastSyncedAt = computed(() => data.value?.last_synced_at ?? null)
  const activeProvider = computed(() => data.value?.provider ?? 'strava')
  /**
   * True only once the server has *answered*. `settled` cannot decide this: a
   * failed read settles too, and deriving this from it turned one 5xx or an
   * offline moment into "not connected" for the whole session — red avatar dot,
   * the notice and a disabled sync, with nothing asking again.
   */
  const checked = computed(() => data.value != null)

  async function checkStatus(force = false): Promise<boolean> {
    if (checked.value && !force) return connected.value
    // A read that failed left the entry settled with no answer: force the retry,
    // or `reload` would serve that failure for the rest of the session.
    await reload(force || settled.value)
    return connected.value
  }

  /**
   * Show the answer the app already knows — the OAuth callback returned, the
   * disconnect returned — without waiting for a round trip, then confirm it
   * with the server. The local write cannot outlive that read: it lands in the
   * same entry the read overwrites.
   */
  function setConnected(value: boolean): void {
    // The link or the disconnect is newer than the auto-sync attempt that ran
    // against the previous connection, so that attempt stops suppressing the
    // next one.
    autoSyncGate.rearm()
    // The link/disconnect is newer than any status request still on the wire,
    // so that request is disowned before the confirming read starts.
    supersedeResource(KEY)
    data.value = { ...(data.value ?? {}), connected: !!value }
    settled.value = true
    void reload(true)
  }

  /** Forget the answer entirely, e.g. after signing in as someone else. */
  function resetConnection(): void {
    autoSyncGate.rearm()
    resetResource(KEY)
  }

  return {
    connected,
    checked,
    lastSyncedAt,
    activeProvider,
    checkStatus,
    setConnected,
    resetConnection,
  }
}

/**
 * Re-read the status in place (a sync moved `last_synced_at`, a link completed).
 * Keeps the current value on screen instead of blanking it, so the notice, the
 * avatar dot and the sync button never flap while the read is in flight.
 */
export function refreshConnectionStatus(): Promise<boolean> {
  return useConnection().checkStatus(true)
}
