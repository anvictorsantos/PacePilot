import { ref } from 'vue'

import api from '@/services/api.ts'

// Athlete-slot capacity (Strava quota). Fetched on public pages so visitors
// see real availability; full → waitlist form instead of a doomed OAuth hop.
const limit = ref<number>(10)
const used = ref<number>(0)
const full = ref<boolean>(false)
const loaded = ref<boolean>(false)
let pending: Promise<{ limit: number; used: number; full: boolean }> | null = null

export function useCapacity() {
  async function checkCapacity(force = false): Promise<{ limit: number; used: number; full: boolean }> {
    if (loaded.value && !force) return { limit: limit.value, used: used.value, full: full.value }
    if (pending) return pending
    pending = api
      .get<{ limit?: number; used?: number; full?: boolean }>('/waitlist/capacity')
      .then(({ data }) => {
        limit.value = data.limit ?? 10
        used.value = data.used ?? 0
        full.value = !!data.full
        loaded.value = true
        return { limit: limit.value, used: used.value, full: full.value }
      })
      .catch(() => {
        loaded.value = true
        return { limit: limit.value, used: used.value, full: false }
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  async function joinWaitlist(email: string): Promise<unknown> {
    const { data } = await api.post('/waitlist', { email })
    return data
  }

  return { limit, used, full, loaded, checkCapacity, joinWaitlist }
}
