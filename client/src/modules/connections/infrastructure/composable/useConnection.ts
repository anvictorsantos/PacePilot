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

// One owner for connection state: the `connection.status` resource, so header avatar,
// feed panel and sync action move together. `setConnected` writes into that entry, then
// forces a server read that wins if the two disagree.
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
  // `settled` cannot decide this: a failed read settles too, which turned one 5xx or an
  // offline moment into "not connected" for the session. True only once the server answered.
  const checked = computed(() => data.value != null)

  async function checkStatus(force = false): Promise<boolean> {
    if (checked.value && !force) return connected.value
    // A read that failed left the entry settled with no answer: force the retry,
    // or `reload` would serve that failure for the rest of the session.
    await reload(force || settled.value)
    return connected.value
  }

  // Show the answer the app already knows (OAuth callback, disconnect), then confirm with
  // the server: the local write lands in the same entry the confirming read overwrites.
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

// Re-read in place (a sync moved `last_synced_at`, a link completed) while keeping the
// current value on screen, so the notice, avatar dot and sync button never flap.
export function refreshConnectionStatus(): Promise<boolean> {
  return useConnection().checkStatus(true)
}
