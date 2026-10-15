import { ref } from 'vue'

import api from '@/services/api.js'

// Athlete-slot capacity (Strava quota). Fetched on public pages so visitors
// see real availability; full → waitlist form instead of a doomed OAuth hop.
const limit = ref(10)
const used = ref(0)
const full = ref(false)
const loaded = ref(false)
let pending = null

export function useCapacity() {
  async function checkCapacity(force = false) {
    if (loaded.value && !force) return { limit: limit.value, used: used.value, full: full.value }
    if (pending) return pending
    pending = api
      .get('/waitlist/capacity')
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

  async function joinWaitlist(email) {
    const { data } = await api.post('/waitlist', { email })
    return data
  }

  return { limit, used, full, loaded, checkCapacity, joinWaitlist }
}
