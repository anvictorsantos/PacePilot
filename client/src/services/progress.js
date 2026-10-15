import api from '@/services/api.js'

export async function getProgress() {
  const { data } = await api.get('/progress')
  return data
}
