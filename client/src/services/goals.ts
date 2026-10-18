import api from '@/services/api.ts'
import type { Goal } from '@/types/domain.ts'

export async function getGoals(): Promise<Goal | null> {
  const { data } = await api.get<Goal | null>('/goals')
  return data ?? null
}

export async function saveGoals(payload: Record<string, unknown>): Promise<Goal | null> {
  const { data } = await api.put<Goal | null>('/goals', payload)
  return data ?? null
}
