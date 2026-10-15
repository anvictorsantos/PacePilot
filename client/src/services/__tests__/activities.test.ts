import { describe, it, expect, vi, beforeEach } from 'vitest'

import { getActivities } from '@/services/activities.ts'
import api from '@/services/api.ts'

vi.mock('@/services/api.ts', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('activities service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls /activities with params and returns data', async () => {
    api.get.mockResolvedValue({ data: { items: [1], total: 1 } })
    const result = await getActivities({ page: 2, perPage: 10, type: 'Run' })
    expect(api.get).toHaveBeenCalledWith('/activities', {
      params: { page: 2, perPage: 10, type: 'Run' },
    })
    expect(result).toEqual({ items: [1], total: 1 })
  })
})
