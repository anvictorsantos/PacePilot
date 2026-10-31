// It must invalidate, not clear: clearing empties every screen on display while
// the import lands. It is also the only place an import can reach Today, not a Resource.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { ResourceCacheInvalidator } from '@/modules/connections/infrastructure/cache/ResourceCacheInvalidator.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'
import { refreshRunDay, useRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { resetResource, useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { http } from '@/modules/shared/infrastructure/http/client.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

const defaultAdapter = http.defaults.adapter

describe('ResourceCacheInvalidator', () => {
  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
    resetResource()
  })

  it('refreshes every derived read in place instead of emptying it', async () => {
    const reads = new Map<string, number>()
    const fetcher = (key: string) => () => {
      const read = (reads.get(key) ?? 0) + 1
      reads.set(key, read)
      return Promise.resolve({ key, read })
    }

    // Readers as the app mounts them: inside a scope, so the invalidation re-reads eagerly.
    const scope = effectScope()
    const keys = [RESOURCE_KEYS.planWeek, RESOURCE_KEYS.progress, RESOURCE_KEYS.connectionStatus]
    const readers = scope.run(() => [
      ...keys.map((key) => useResource(key, fetcher(key), { immediate: false })),
      useResource('activities:all:1', fetcher('activities:all:1'), { immediate: false }),
    ])
    if (!readers) throw new Error('readers not created inside the scope')
    await Promise.all(readers.map((reader) => reader.reload()))

    new ResourceCacheInvalidator().invalidateAfterImport()

    for (const reader of readers) expect(reader.data.value).toMatchObject({ read: 1 })

    for (const reader of readers) {
      await vi.waitFor(() => expect(reader.data.value).toMatchObject({ read: 2 }))
    }
    expect([...reads.values()]).toEqual([2, 2, 2, 2])
    scope.stop()
  })

  it("re-reads today's session on every import, forced", async () => {
    // Run-day is a module projection guarded by `loaded`: without this call an
    // import that lands after Today mounted never completes the card.
    const refreshToday = vi.fn().mockResolvedValue(undefined)

    new ResourceCacheInvalidator(refreshToday).invalidateAfterImport()

    expect(refreshToday).toHaveBeenCalledTimes(1)
  })

  it('stays a successful import when the run-day re-read fails', () => {
    const refreshToday = vi.fn(() => Promise.reject(new Error('today is down')))

    expect(() => new ResourceCacheInvalidator(refreshToday).invalidateAfterImport()).not.toThrow()
    expect(refreshToday).toHaveBeenCalledTimes(1)
  })

  it('completes Today when the import lands after Today already read', async () => {
    let imported = false
    http.defaults.adapter = async (config) => {
      const url = config.url ?? ''
      const data =
        url === '/providers/status'
          ? { connected: true, provider: 'strava' }
          : url.includes('/providers/strava/sync')
            ? ((imported = true), { imported: 1 })
            : url === '/plan/feedback'
              ? []
              : url === '/activities'
                ? {
                    items: imported
                      ? [{ id: 9, date: LocalDateKey.today().value, kind: 'run' }]
                      : [],
                  }
                : {}
      return { data, status: 200, statusText: 'OK', headers: {}, config }
    }

    await refreshRunDay()
    expect(useRunDay().completed.value).toBe(false)

    // The same call the boot auto-import and the panel's button both make.
    await connectionsModule.sync.execute({ announce: false })

    await vi.waitFor(() => expect(useRunDay().completed.value).toBe(true))
    expect(useRunDay().activity.value?.id).toBe(9)
  })
})
