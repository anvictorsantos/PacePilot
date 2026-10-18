import { describe, it, expect, vi, beforeEach } from 'vitest'

import api from '@/services/api.ts'
import { getProgress } from '@/services/progress.ts'

vi.mock('@/services/api.ts', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('progress service', () => {
  beforeEach(() => vi.clearAllMocks())
  it('gets progress', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { totalDistance: 10 } } as never)
    const result = await getProgress()
    expect(api.get).toHaveBeenCalledWith('/progress')
    expect(result).toEqual({ totalDistance: 10 })
  })
})
