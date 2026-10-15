import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/services/api.ts'
import { getGoals, saveGoals } from '@/services/goals.ts'

vi.mock('@/services/api.ts', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('goals service', () => {
  beforeEach(() => vi.clearAllMocks())
  it('gets goals', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { goal_type: '5K' } } as never)
    await getGoals()
    expect(api.get).toHaveBeenCalledWith('/goals')
  })
  it('saves goals', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { goal_type: '5K' } } as never)
    await saveGoals({ goal_type: '5K' })
    expect(api.put).toHaveBeenCalledWith('/goals', { goal_type: '5K' })
  })
})
