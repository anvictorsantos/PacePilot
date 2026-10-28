/**
 * The adapter that reacts to an import. It is the wiring the whole app inherits:
 * if it clears instead of invalidating, every screen on display empties itself
 * while the import that caused it lands.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResourceCacheInvalidator } from '@/modules/connections/infrastructure/cache/ResourceCacheInvalidator.ts'
import { resetResource, useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

describe('ResourceCacheInvalidator', () => {
  afterEach(() => {
    resetResource()
  })

  it('refreshes every derived read in place instead of emptying it', async () => {
    const reads = new Map<string, number>()
    const fetcher = (key: string) => () => {
      const read = (reads.get(key) ?? 0) + 1
      reads.set(key, read)
      return Promise.resolve({ key, read })
    }

    const keys = [RESOURCE_KEYS.planWeek, RESOURCE_KEYS.progress, RESOURCE_KEYS.connectionStatus]
    const readers = keys.map((key) =>
      useResource(key, fetcher(key), {
        immediate: false,
      }),
    )
    const activities = useResource('activities:all:1', fetcher('activities:all:1'), {
      immediate: false,
    })
    await Promise.all([...readers, activities].map((reader) => reader.reload()))

    new ResourceCacheInvalidator().invalidateAfterImport()

    // Nothing is emptied at the moment of the invalidation.
    for (const reader of readers) expect(reader.data.value).toMatchObject({ read: 1 })
    expect(activities.data.value).toMatchObject({ read: 1 })

    // Each read refreshes itself once, in place.
    for (const reader of [...readers, activities]) {
      await vi.waitFor(() => expect(reader.data.value).toMatchObject({ read: 2 }))
    }
    expect([...reads.values()]).toEqual([2, 2, 2, 2])
  })
})
