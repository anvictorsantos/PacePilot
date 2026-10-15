import api from '@/services/api.ts'

import type { PlanFeedback, PlanTodayResponse, PlanWeekResponse } from '@/types/domain.ts'

export async function getPlanWeek(): Promise<PlanWeekResponse> {
  const { data } = await api.get<PlanWeekResponse>('/plan/week')
  return data ?? {}
}

export async function getPlanToday(): Promise<PlanTodayResponse> {
  const { data } = await api.get<PlanTodayResponse>('/plan/today')
  return data ?? {}
}

export async function getPlanFeedback(): Promise<PlanFeedback[] | null> {
  const { data } = await api.get<PlanFeedback[] | null>('/plan/feedback')
  return data ?? null
}

export async function submitPlanFeedback(payload: Record<string, unknown>): Promise<unknown> {
  const { data } = await api.post<unknown>('/plan/feedback', payload)
  return data ?? null
}
