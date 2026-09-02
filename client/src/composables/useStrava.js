import { ref } from 'vue'
import api from '../services/api.js'

export function useStrava() {
  const status = ref(null)
  const loading = ref(false)

  async function fetchStatus() {
    const { data } = await api.get('/strava/status')
    status.value = data
  }
  async function sync() {
    loading.value = true
    try { await api.post('/strava/sync') } finally { loading.value = false }
  }
  async function disconnect() {
    await api.post('/strava/disconnect')
    status.value = { connected: false }
  }
  function connect() {
    window.location.href = '/api/strava/authorize'
  }
  return { status, loading, fetchStatus, sync, disconnect, connect }
}
