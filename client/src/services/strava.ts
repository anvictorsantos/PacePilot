import api from '@/services/api.ts'
import type { StravaStatus } from '@/types/domain.ts'

export async function getStravaStatus(): Promise<StravaStatus> {
  const { data } = await api.get<StravaStatus>('/strava/status')
  return data ?? {}
}

export async function syncStrava(): Promise<unknown> {
  const { data } = await api.post<unknown>('/strava/sync')
  return data ?? null
}

export async function disconnectStrava(): Promise<void> {
  await api.post('/strava/disconnect')
}
