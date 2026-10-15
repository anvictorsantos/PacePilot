import api from '@/services/api.ts'

export async function deleteAccount(): Promise<void> {
  await api.delete('/me')
}
