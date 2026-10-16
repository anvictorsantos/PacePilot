import api from '@/services/api.ts'

import type {
  AiStatusResponse,
  PlanAiWeekResponse,
  PlanFeedback,
  PlanTodayResponse,
  PlanWeekResponse,
} from '@/types/domain.ts'

export async function getPlanWeek(): Promise<PlanWeekResponse> {
  const { data } = await api.get<PlanWeekResponse>('/plan/week')
  return data ?? {}
}

export async function getPlanToday(): Promise<PlanTodayResponse> {
  const { data } = await api.get<PlanTodayResponse>('/plan/today')
  return data ?? {}
}

/**
 * AI coaching copy for the deterministic week. Separate call so the plan renders
 * instantly without spending provider quota. Resolves with `degraded` set when
 * AI is unavailable — that is a normal outcome, not a thrown error.
 */
export async function getPlanAiWeek(): Promise<PlanAiWeekResponse> {
  const { data } = await api.get<PlanAiWeekResponse>('/plan/ai/week')
  return data ?? {}
}

/** Free-tier health: whether the configured model is still in the free catalog. */
export async function getAiStatus(): Promise<AiStatusResponse> {
  const { data } = await api.get<AiStatusResponse>('/plan/ai/status')
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
