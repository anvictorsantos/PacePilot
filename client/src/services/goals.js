import api from '@/services/api.js'

export async function getGoals() {
  const { data } = await api.get('/goals')
  return data
}

export async function saveGoals(payload) {
  const { data } = await api.put('/goals', payload)
  return data
}
