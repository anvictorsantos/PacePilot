import api from '@/services/api.js'

export async function getPlanWeek() {
  const { data } = await api.get('/plan/week')
  return data
}

export async function getPlanToday() {
  const { data } = await api.get('/plan/today')
  return data
}

export async function getPlanFeedback() {
  const { data } = await api.get('/plan/feedback')
  return data
}

export async function submitPlanFeedback(payload) {
  const { data } = await api.post('/plan/feedback', payload)
  return data
}
