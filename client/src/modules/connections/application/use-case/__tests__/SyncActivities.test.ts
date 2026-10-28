import { describe, expect, it, vi } from 'vitest'

import { SyncActivities } from '@/modules/connections/application/use-case/SyncActivities.ts'
import type {
  ProviderSyncRepository,
  SyncOutcome,
} from '@/modules/connections/domain/repository/provider-sync.repository.ts'
import type { ProviderSyncNotifier } from '@/modules/connections/domain/service/provider-sync-notifier.ts'
import { SyncStatus } from '@/modules/connections/domain/value-object/SyncStatus.ts'

function outcome(overrides: Partial<SyncOutcome> = {}): SyncOutcome {
  return {
    imported: 0,
    updated: 0,
    totalFetched: 0,
    truncated: false,
    status: SyncStatus.Completed,
    lastSyncedAt: null,
    ...overrides,
  }
}

function setup(result: SyncOutcome | Error = outcome()) {
  const repository: ProviderSyncRepository = {
    importActivities: vi.fn(async () => {
      if (result instanceof Error) throw result
      return result
    }),
  }
  const cache = { invalidateAfterImport: vi.fn() }
  const notifier: ProviderSyncNotifier = {
    imported: vi.fn(),
    updated: vi.fn(),
    importedAndUpdated: vi.fn(),
    upToDate: vi.fn(),
    throttled: vi.fn(),
    disconnected: vi.fn(),
    failed: vi.fn(),
  }
  const useCase = new SyncActivities(repository, cache, notifier)
  return { repository, cache, notifier, useCase }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('SyncActivities', () => {
  it('invalidates the derived reads and announces new activities', async () => {
    const { cache, notifier, useCase } = setup(outcome({ imported: 3 }))
    await useCase.execute()
    expect(cache.invalidateAfterImport).toHaveBeenCalledOnce()
    expect(notifier.imported).toHaveBeenCalledWith(3)
    expect(notifier.upToDate).not.toHaveBeenCalled()
  })

  it('invalidates and announces when the import only rewrote existing activities', async () => {
    const { cache, notifier, useCase } = setup(
      outcome({ imported: 0, updated: 2, totalFetched: 2 }),
    )
    await useCase.execute()
    // Every fetched row is rewritten, so an upstream correction is a change too.
    expect(cache.invalidateAfterImport).toHaveBeenCalledOnce()
    expect(notifier.updated).toHaveBeenCalledWith(2)
    expect(notifier.upToDate).not.toHaveBeenCalled()
  })

  it('announces new and updated activities together', async () => {
    const { cache, notifier, useCase } = setup(
      outcome({ imported: 2, updated: 3, totalFetched: 5 }),
    )
    await useCase.execute()
    expect(cache.invalidateAfterImport).toHaveBeenCalledOnce()
    expect(notifier.importedAndUpdated).toHaveBeenCalledWith(2, 3)
  })

  it('says nothing changed and leaves the cache alone on an empty import', async () => {
    const { cache, notifier, useCase } = setup()
    await useCase.execute()
    expect(notifier.upToDate).toHaveBeenCalledOnce()
    expect(cache.invalidateAfterImport).not.toHaveBeenCalled()
  })

  it('says the server throttled it instead of claiming nothing changed', async () => {
    const { cache, notifier, useCase } = setup(outcome({ status: SyncStatus.Throttled }))
    await useCase.execute()
    expect(notifier.throttled).toHaveBeenCalledOnce()
    expect(notifier.upToDate).not.toHaveBeenCalled()
    expect(cache.invalidateAfterImport).not.toHaveBeenCalled()
  })

  it('tells the athlete to connect a provider when none is linked', async () => {
    const { cache, notifier, useCase } = setup(outcome({ status: SyncStatus.Disconnected }))
    await useCase.execute()
    expect(notifier.disconnected).toHaveBeenCalledOnce()
    expect(notifier.upToDate).not.toHaveBeenCalled()
    expect(cache.invalidateAfterImport).not.toHaveBeenCalled()
  })

  it('announces a failure and rethrows so the caller can stop its spinner', async () => {
    const { notifier, useCase } = setup(new Error('boom'))
    await expect(useCase.execute()).rejects.toThrow('boom')
    expect(notifier.failed).toHaveBeenCalledOnce()
  })

  it('shares one running import between two manual callers', async () => {
    const { repository, useCase } = setup(outcome({ imported: 1 }))
    await Promise.all([useCase.execute({ force: true }), useCase.execute({ force: true })])
    expect(repository.importActivities).toHaveBeenCalledTimes(1)
  })

  it('lets an automatic call ride the manual import already running', async () => {
    const { repository, useCase } = setup(outcome({ imported: 1 }))
    await Promise.all([useCase.execute({ force: true }), useCase.execute({ announce: false })])
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

  it('forces a real import when a manual sync lands during an automatic one', async () => {
    const automatic = deferred<SyncOutcome>()
    const importActivities = vi
      .fn<ProviderSyncRepository['importActivities']>()
      .mockImplementationOnce(() => automatic.promise)
      .mockImplementationOnce(async () => outcome({ imported: 1 }))
    const repository: ProviderSyncRepository = { importActivities }
    const cache = { invalidateAfterImport: vi.fn() }
    const notifier: ProviderSyncNotifier = {
      imported: vi.fn(),
      updated: vi.fn(),
      importedAndUpdated: vi.fn(),
      upToDate: vi.fn(),
      throttled: vi.fn(),
      disconnected: vi.fn(),
      failed: vi.fn(),
    }
    const useCase = new SyncActivities(repository, cache, notifier)

    const silent = useCase.execute({ announce: false })
    const manual = useCase.execute({ force: true })

    automatic.resolve(outcome({ imported: 1 }))
    await Promise.all([silent, manual])

    // Folding the click into the automatic run lets the server's freshness
    // window answer "nothing new" to a request the athlete actually made.
    expect(importActivities).toHaveBeenCalledTimes(2)
    expect(importActivities).toHaveBeenNthCalledWith(2, { force: true })
  })
})
