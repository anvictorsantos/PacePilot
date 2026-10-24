import { computed, ref } from 'vue'

import type { ConnectionStatus } from '@/modules/connections/infrastructure/dto/ConnectionStatus.ts'
import { useResource, resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

// Shared session truth for the auth gate, read through the Resource module so
// the `/providers/status` request is made once per page load and reused by the
// header, the connect view and the router guard.
const KEY = 'connection.status'

// Set by the OAuth callback and by disconnect, where the client already knows
// the answer and re-reading would race the redirect.
const override = ref<boolean | null>(null)

export function useConnection() {
  const { data, settled, reload } = useResource<ConnectionStatus>(
    KEY,
    () => api.providers.status(),
    {
      immediate: false,
    },
  )

  const connected = computed(() => override.value ?? Boolean(data.value?.connected))
  const lastSyncedAt = computed(() => data.value?.last_synced_at ?? null)
  const activeProvider = computed(() => data.value?.provider ?? 'strava')
  const checked = computed(() => settled.value || override.value !== null)

  async function checkStatus(force = false): Promise<boolean> {
    if (checked.value && !force) return connected.value
    await reload(force)
    return connected.value
  }

  function setConnected(v: boolean): void {
    override.value = !!v
  }

  /** Forget a locally forced answer, e.g. after signing in as someone else. */
  function resetConnection(): void {
    override.value = null
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
