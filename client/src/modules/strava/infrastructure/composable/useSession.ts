import { computed, ref } from 'vue'

import { useResource, resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import type { StravaStatus } from '@/modules/strava/infrastructure/dto/StravaStatus.ts'

// Shared session truth for the auth gate, read through the Resource module so
// the `/strava/status` request is made once per page load and reused by the
// header, the connect view and the router guard.
const KEY = 'strava.status'

// Set by the OAuth callback and by disconnect, where the client already knows
// the answer and re-reading would race the redirect.
const override = ref<boolean | null>(null)

export function useSession() {
  const { data, settled, reload } = useResource<StravaStatus>(KEY, () => api.strava.status(), {
    immediate: false,
  })

  const connected = computed(() => override.value ?? Boolean(data.value?.connected))
  const lastSyncedAt = computed(() => data.value?.last_synced_at ?? null)
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
    checkStatus,
    setConnected,
    resetConnection,
  }
}
