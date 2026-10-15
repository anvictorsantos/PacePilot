import api from '@/services/api.js'

export async function deleteAccount() {
  await api.delete('/me')
}
