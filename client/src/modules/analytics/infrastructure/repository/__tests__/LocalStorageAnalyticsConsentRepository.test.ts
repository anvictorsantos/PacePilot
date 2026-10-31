// These adapters are where a private-mode or quota failure becomes a decision: a
// refused read must never be mistaken for the athlete's answer.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import { LocalStorageAnalyticsConsentRepository } from '@/modules/analytics/infrastructure/repository/LocalStorageAnalyticsConsentRepository.ts'
import { LocalStorageSignupMarker } from '@/modules/analytics/infrastructure/repository/LocalStorageSignupMarker.ts'

function storage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial))
  return {
    entries,
    api: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LocalStorageAnalyticsConsentRepository', () => {
  it('remembers the answer across reads', () => {
    const { api } = storage()
    vi.stubGlobal('localStorage', api)
    const repository = new LocalStorageAnalyticsConsentRepository()

    repository.write(AnalyticsConsent.Granted)

    expect(repository.read()).toBe(AnalyticsConsent.Granted)
  })

  it('reads an unanswered banner as undecided', () => {
    vi.stubGlobal('localStorage', storage().api)

    expect(new LocalStorageAnalyticsConsentRepository().read()).toBeNull()
  })

  it('ignores a value it did not write', () => {
    const { api } = storage({ 'pacepilot-analytics-consent': 'yes-please' })
    vi.stubGlobal('localStorage', api)

    expect(new LocalStorageAnalyticsConsentRepository().read()).toBeNull()
  })

  it('treats a storage failure as undecided', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })

    expect(new LocalStorageAnalyticsConsentRepository().read()).toBeNull()
  })
})

describe('LocalStorageSignupMarker', () => {
  it('sends once per browser', () => {
    const { api } = storage()
    vi.stubGlobal('localStorage', api)
    const marker = new LocalStorageSignupMarker()

    expect(marker.sent()).toBe(false)
    marker.remember()
    expect(marker.sent()).toBe(true)
  })

  it('never invents a signup when storage is unreadable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })

    expect(new LocalStorageSignupMarker().sent()).toBe(true)
  })
})
