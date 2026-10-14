import { ref } from 'vue'
import api from '@/services/api.js'

const user = ref(null)
const loading = ref(false)
let fetched = false

export function useCurrentUser() {
  async function fetchUser(force = false) {
    if (fetched && !force) return user.value
    loading.value = true
    try {
      const { data } = await api.get('/me')
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
