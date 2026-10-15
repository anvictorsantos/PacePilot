import { ref } from 'vue'

import api from '@/services/api.ts'

// Shared session truth for the auth gate. Cached per page load — OAuth
// callback and login/logout force a refresh.
const connected = ref<boolean>(false)
const checked = ref<boolean>(false)
let pending: Promise<boolean> | null = null

export function useSession() {
  async function checkStatus(force = false): Promise<boolean> {
    if (checked.value && !force) return connected.value
    if (pending) return pending
    pending = api
      .get<{ connected?: boolean }>('/strava/status')
      .then(({ data }) => {
        connected.value = !!data.connected
        checked.value = true
        return connected.value
      })
      .catch(() => {
        connected.value = false
        checked.value = true
        return false
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  function setConnected(v) {
    connected.value = !!v
    checked.value = true
  }

  return { connected, checked, checkStatus, setConnected }
}
