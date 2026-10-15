import api from '@/services/api.js'

export async function getActivities(params = {}) {
  const { data } = await api.get('/activities', { params })
  return data
}

export async function getActivity(id) {
  const { data } = await api.get(`/activities/${id}`)
  return data
}
