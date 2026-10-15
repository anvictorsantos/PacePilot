import { ref } from 'vue'

import api from '@/services/api.ts'
import type { CurrentUser } from '@/types/domain.ts'

const user = ref<CurrentUser | null>(null)
const loading = ref(false)
let fetched = false

export function useCurrentUser() {
  async function fetchUser(force = false): Promise<CurrentUser | null> {
    if (fetched && !force) return user.value
    loading.value = true
    try {
      const { data } = await api.get<{ user?: CurrentUser | null }>('/me')
      user.value = data.user || null
      fetched = true
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
    return user.value
  }

  function clearUser() {
    user.value = null
    fetched = false
  }

  return { user, loading, fetchUser, clearUser }
}
