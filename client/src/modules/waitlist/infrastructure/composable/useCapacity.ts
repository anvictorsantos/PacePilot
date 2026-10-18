import { computed } from 'vue'

import { useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import type { WaitlistCapacity } from '@/modules/waitlist/infrastructure/dto/WaitlistCapacity.ts'

// Athlete-slot capacity (Strava quota). Fetched on public pages so visitors see
// real availability; full → waitlist form instead of a doomed OAuth hop.
const KEY = 'waitlist.capacity'

const DEFAULTS = { limit: 10, used: 0, full: false }

export function useCapacity() {
  const { data, settled, reload } = useResource<WaitlistCapacity>(
    KEY,
    () => api.waitlist.capacity(),
    { immediate: false },
  )

  const limit = computed(() => data.value?.limit ?? DEFAULTS.limit)
  const used = computed(() => data.value?.used ?? DEFAULTS.used)
  const full = computed(() => Boolean(data.value?.full))
  const loaded = computed(() => settled.value)

  async function checkCapacity(
    force = false,
  ): Promise<{ limit: number; used: number; full: boolean }> {
    if (loaded.value && !force) return { limit: limit.value, used: used.value, full: full.value }
    await reload(force)
    return { limit: limit.value, used: used.value, full: full.value }
  }

  return { limit, used, full, loaded, checkCapacity }
}
