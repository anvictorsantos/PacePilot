import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/services/api.ts'
import { getStravaStatus, syncStrava, disconnectStrava } from '@/services/strava.ts'

vi.mock('@/services/api.ts', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('strava service', () => {
  beforeEach(() => vi.clearAllMocks())
  it('gets status', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { connected: true } } as never)
    const result = await getStravaStatus()
    expect(api.get).toHaveBeenCalledWith('/strava/status')
    expect(result).toEqual({ connected: true })
  })
  it('syncs', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } } as never)
    await syncStrava()
    expect(api.post).toHaveBeenCalledWith('/strava/sync')
  })
  it('disconnects', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never)
    await disconnectStrava()
    expect(api.post).toHaveBeenCalledWith('/strava/disconnect')
  })
})
