import { describe, expect, it, vi } from 'vitest'

import { SyncActivities } from '@/modules/strava/application/use-case/SyncActivities.ts'
import type {
  StravaSyncRepository,
  SyncOutcome,
} from '@/modules/strava/domain/repository/strava-sync.repository.ts'

function outcome(overrides: Partial<SyncOutcome> = {}): SyncOutcome {
  return {
    imported: 0,
    skipped: 0,
    totalFetched: 0,
    total: 0,
    truncated: false,
    lastSyncedAt: null,
    guarded: false,
    ...overrides,
  }
}

function setup(result: SyncOutcome | Error = outcome()) {
  const repository: StravaSyncRepository = {
    importActivities: vi.fn(async () => {
      if (result instanceof Error) throw result
      return result
    }),
  }
  const cache = { invalidateAfterImport: vi.fn() }
  const notifier = { imported: vi.fn(), upToDate: vi.fn(), failed: vi.fn() }
  const useCase = new SyncActivities(repository, cache, notifier)
  return { repository, cache, notifier, useCase }
}

describe('SyncActivities', () => {
  it('invalidates the derived reads and announces new activities', async () => {
    const { cache, notifier, useCase } = setup(outcome({ imported: 3 }))
    await useCase.execute()
    expect(cache.invalidateAfterImport).toHaveBeenCalledOnce()
    expect(notifier.imported).toHaveBeenCalledWith(3)
    expect(notifier.upToDate).not.toHaveBeenCalled()
  })

  it('says nothing changed and leaves the cache alone on an empty import', async () => {
    const { cache, notifier, useCase } = setup()
    await useCase.execute()
    expect(notifier.upToDate).toHaveBeenCalledOnce()
    expect(cache.invalidateAfterImport).not.toHaveBeenCalled()
  })

  it('stays silent when the server throttled the call', async () => {
    const { cache, notifier, useCase } = setup(outcome({ guarded: true }))
    await useCase.execute()
    expect(notifier.imported).not.toHaveBeenCalled()
    expect(notifier.upToDate).not.toHaveBeenCalled()
    expect(cache.invalidateAfterImport).not.toHaveBeenCalled()
  })

  it('announces a failure and rethrows so the caller can stop its spinner', async () => {
    const { notifier, useCase } = setup(new Error('boom'))
    await expect(useCase.execute()).rejects.toThrow('boom')
    expect(notifier.failed).toHaveBeenCalledOnce()
  })

  it('shares one running import between the auto and manual callers', async () => {
    const { repository, useCase } = setup(outcome({ imported: 1 }))
    await Promise.all([useCase.execute(), useCase.execute({ force: true })])
    expect(repository.importActivities).toHaveBeenCalledTimes(1)
  })

  it('stays quiet when the caller asked for a silent import', async () => {
    const { cache, notifier, useCase } = setup(outcome({ imported: 2 }))
    await useCase.execute({ announce: false })
    expect(notifier.imported).not.toHaveBeenCalled()
    expect(notifier.upToDate).not.toHaveBeenCalled()
    // The cache still has to be dropped: the reads are stale regardless of copy.
    expect(cache.invalidateAfterImport).toHaveBeenCalledOnce()
  })

  it('allows a new import after the previous one settled', async () => {
    const { repository, useCase } = setup(outcome({ imported: 1 }))
    await useCase.execute()
    await useCase.execute()
    expect(repository.importActivities).toHaveBeenCalledTimes(2)
  })
})
