import { beforeEach, describe, expect, it, vi } from 'vitest'

const preferences = {
  explanations: true,
  sessionReminder: false,
  weeklySummary: false,
  locale: 'en' as const,
}

const api = {
  account: {
    preferences: vi.fn(),
    savePreferences: vi.fn(),
  },
}

vi.mock('@/modules/shared/infrastructure/http/client.ts', () => ({ api }))
vi.mock('@/modules/shared/infrastructure/observability/logger.ts', () => ({
  recordRecoveredError: vi.fn(),
}))

async function freshComposable() {
  vi.resetModules()
  return import('@/modules/account/infrastructure/composable/useCoachingPreferences.ts')
}

beforeEach(() => {
  vi.clearAllMocks()
  api.account.preferences.mockResolvedValue({ ...preferences })
  api.account.savePreferences.mockImplementation(async (patch) => ({
    ...preferences,
    ...patch,
  }))
})

describe('useCoachingPreferences', () => {
  it('loads once and saves a patch', async () => {
    const { useCoachingPreferences } = await freshComposable()
    const state = useCoachingPreferences()

    await state.load()
    await state.load()
    expect(api.account.preferences).toHaveBeenCalledTimes(1)
    expect(state.explanationsEnabled.value).toBe(true)

    await state.save({ explanations: false, locale: 'pt' })
    expect(state.explanationsEnabled.value).toBe(false)
    expect(api.account.savePreferences).toHaveBeenCalledWith({ explanations: false, locale: 'pt' })
  })

  it('reverts the optimistic switch when the write fails', async () => {
    const { useCoachingPreferences } = await freshComposable()
    const state = useCoachingPreferences()
    await state.load()
    api.account.savePreferences.mockRejectedValueOnce(new Error('offline'))

    await expect(state.save({ sessionReminder: true })).rejects.toThrow('offline')
    expect(state.preferences.value?.sessionReminder).toBe(false)
  })
})
