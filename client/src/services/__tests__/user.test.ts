import { describe, it, expect, vi, beforeEach } from 'vitest'

import api from '@/services/api.ts'
import { deleteAccount } from '@/services/user.ts'

vi.mock('@/services/api.ts', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('user service', () => {
  beforeEach(() => vi.clearAllMocks())
  it('deletes account', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} } as never)
    await deleteAccount()
    expect(api.delete).toHaveBeenCalledWith('/me')
  })
})
