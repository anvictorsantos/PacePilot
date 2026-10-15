import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/services/api.ts'
import { getPlanWeek, getPlanToday, getPlanFeedback, submitPlanFeedback } from '@/services/plan.ts'

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
