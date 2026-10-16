import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/services/api.ts'
import {
  getAiStatus,
  getPlanAiWeek,
  getPlanWeek,
  getPlanToday,
  getPlanFeedback,
  submitPlanFeedback,
} from '@/services/plan.ts'

vi.mock('@/services/api.ts', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('plan service', () => {
  beforeEach(() => vi.clearAllMocks())
  it('gets week', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { week: [] } } as never)
    const result = await getPlanWeek()
    expect(api.get).toHaveBeenCalledWith('/plan/week')
    expect(result).toEqual({ week: [] })
  })
  it('gets today', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { date: '2026-10-15' } } as never)
    await getPlanToday()
    expect(api.get).toHaveBeenCalledWith('/plan/today')
  })
  it('gets feedback', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never)
    await getPlanFeedback()
    expect(api.get).toHaveBeenCalledWith('/plan/feedback')
  })
  it('submits feedback', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } } as never)
    await submitPlanFeedback({ rpe: 5 })
    expect(api.post).toHaveBeenCalledWith('/plan/feedback', { rpe: 5 })
  })
})

describe('AI plan service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests AI copy from its own endpoint, not from /plan/week', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { week: [] } } as never)
    await getPlanAiWeek()
    expect(api.get).toHaveBeenCalledWith('/plan/ai/week')
  })

  it('passes a degraded response through instead of throwing', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { week: [], degraded: 'AI free-tier quota exhausted — try again later', code: 'rate_limited' },
    } as never)
    const result = await getPlanAiWeek()
    expect(result.degraded).toMatch(/quota/i)
    expect(result.week).toEqual([])
  })

  it('returns suggestions and cache flag on success', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        week: [{ date: '2026-10-12', aiExplanation: 'easy aerobic day', aiSuggestedType: null }],
        suggestions: [{ dayIndex: 0, suggestedType: 'recovery', reason: 'fatigue' }],
        model: 'google/gemma-4-31b-it:free',
        cached: true,
      },
    } as never)
    const result = await getPlanAiWeek()
    expect(result.cached).toBe(true)
    expect(result.suggestions?.[0]?.suggestedType).toBe('recovery')
  })

  it('reads AI status', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { enabled: true, modelStillFree: true } } as never)
    const result = await getAiStatus()
    expect(api.get).toHaveBeenCalledWith('/plan/ai/status')
    expect(result.modelStillFree).toBe(true)
  })
})
