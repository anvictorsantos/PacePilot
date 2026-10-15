import api from '@/services/api.js'

export async function getStravaStatus() {
  const { data } = await api.get('/strava/status')
  return data
}

export async function syncStrava() {
  const { data } = await api.post('/strava/sync')
  return data
}

export async function disconnectStrava() {
  await api.post('/strava/disconnect')
}
