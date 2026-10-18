import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useSession } from '@/composables/useSession.ts'
import api from '@/services/api.ts'

vi.mock('@/services/api.ts', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('useSession', () => {
  beforeEach(() => vi.clearAllMocks())
  it('checks connected', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { connected: true } } as never)
    const { checkStatus } = useSession()
    const value = await checkStatus()
    expect(value).toBe(true)
  })
})
