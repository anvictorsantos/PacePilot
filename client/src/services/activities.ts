import api from '@/services/api.ts'
import type { ActivitiesResponse, Activity } from '@/types/domain.ts'

export async function getActivities(
  params: Record<string, unknown> = {},
): Promise<ActivitiesResponse> {
  const { data } = await api.get<ActivitiesResponse>('/activities', { params })
  return data ?? {}
}

export async function getActivity(id: string | number): Promise<Activity | null> {
  const { data } = await api.get<Activity>(`/activities/${id}`)
  return data ?? null
}
