/**
 * The Resource module is the seam every read crosses: cache, in-flight dedupe,
 * stale-while-revalidate and the error surface. Tested through its interface —
 * no component, no mount — because that is what callers and tests share.
 */
import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import {
  invalidateResource,
  invalidateResourcePrefix,
  resetResource,
  resetResourcePrefix,
  useResource,
} from '@/modules/shared/infrastructure/cache/useResource.ts'

describe('useResource', () => {
  it('reads once and serves the cached value to the next caller', async () => {
    const fetcher = vi.fn().mockResolvedValue({ total: 3 })
    const first = useResource('t.cache', fetcher, { immediate: false })
    await first.reload()
    expect(first.data.value).toEqual({ total: 3 })

    const second = useResource('t.cache', fetcher, { immediate: false })
    await second.reload()
    expect(second.data.value).toEqual({ total: 3 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent readers of the same key into one request', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true })
    const a = useResource('t.dedupe', fetcher, { immediate: false })
    const b = useResource('t.dedupe', fetcher, { immediate: false })

    await Promise.all([a.reload(), b.reload()])

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(b.data.value).toEqual({ ok: true })
  })

  it('re-reads when forced', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })
    const resource = useResource('t.force', fetcher, { immediate: false })

    await resource.reload()
    expect(resource.data.value).toEqual({ n: 1 })
    await resource.reload(true)
    expect(resource.data.value).toEqual({ n: 2 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('surfaces the failure and keeps the last good value', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockRejectedValueOnce(new Error('offline'))
    const resource = useResource('t.stale', fetcher, { immediate: false })

    await resource.reload()
    await resource.reload(true)

    expect(resource.error.value).toBeInstanceOf(Error)
    expect(resource.data.value).toEqual({ n: 1 })
    expect(resource.loading.value).toBe(false)
    expect(resource.settled.value).toBe(true)
  })

  it('shares the refs of a key, so a read in one caller reaches the others', async () => {
    // The shell fetches /me while the avatar and the menu label read the same
    // key from separate composable calls; per-caller refs left those two on null.
    const fetcher = vi.fn().mockResolvedValue({ firstname: 'Ana' })
    const writer = useResource('t.shared', fetcher, { immediate: false })
    const reader = useResource('t.shared', fetcher, { immediate: false })

    await writer.reload()

    expect(reader.data.value).toEqual({ firstname: 'Ana' })
    expect(reader.settled.value).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('resolves null on failure so callers never handle a raw rejection', async () => {
    const resource = useResource('t.null', () => Promise.reject(new Error('boom')), {
      immediate: false,
    })
    await expect(resource.reload()).resolves.toBeNull()
  })

  it('re-reads when a getter key changes, and drops the previous value', async () => {
    const fetcher = vi.fn((page: number) => Promise.resolve({ page }))
    const page = ref(1)
    const resource = useResource(
      () => `t.paged:${page.value}`,
      () => fetcher(page.value),
      {
        immediate: false,
      },
    )

    await resource.reload()
    expect(resource.data.value).toEqual({ page: 1 })

    page.value = 2
    await resource.reload()
    expect(resource.data.value).toEqual({ page: 2 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('forgets a key on reset so the next reader re-reads it', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 })
    const resource = useResource('t.reset', fetcher, { immediate: false })
    await resource.reload()

    resetResource('t.reset')
    await resource.reload()

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('forgets every paged key under a prefix', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true })
    const first = useResource('t.list:all:1', fetcher, { immediate: false })
    const page2 = useResource('t.list:all:2', fetcher, { immediate: false })
    const other = useResource('t.other', fetcher, { immediate: false })
    await Promise.all([first.reload(), page2.reload(), other.reload()])

    resetResourcePrefix('t.list:')
    await Promise.all([first.reload(), page2.reload(), other.reload()])

    // The two list keys re-read; the unrelated key stays cached.
    expect(fetcher).toHaveBeenCalledTimes(5)
  })
})

describe('useResource invalidation', () => {
  it('keeps the last good value on screen while the invalidation refreshes it', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })
    const resource = useResource('t.invalidate', fetcher, { immediate: false })
    await resource.reload()

    invalidateResource('t.invalidate')

    // The screen keeps its value at the instant of the invalidation, then the
    // fresh one arrives in place.
    expect(resource.data.value).toEqual({ n: 1 })
    await vi.waitFor(() => expect(resource.data.value).toEqual({ n: 2 }))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('refreshes once per invalidation however many readers share the key', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })
    const first = useResource('t.once', fetcher, { immediate: false })
    const second = useResource('t.once', fetcher, { immediate: false })
    await Promise.all([first.reload(), second.reload()])
    expect(fetcher).toHaveBeenCalledTimes(1)

    invalidateResource('t.once')

    // One re-read for the key, not one per reader, and both readers see it.
    await vi.waitFor(() => expect(second.data.value).toEqual({ n: 2 }))
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(first.data.value).toEqual({ n: 2 })
  })

  it('covers every cached variant of a paged set, on screen or not', async () => {
    const reads = new Map<string, number>()
    const fetcher = vi.fn((variant: string) => {
      const read = (reads.get(variant) ?? 0) + 1
      reads.set(variant, read)
      return Promise.resolve({ variant, read })
    })
    const visible = useResource('t.paged:all:2', () => fetcher('t.paged:all:2'), {
      immediate: false,
    })
    await visible.reload()

    // A variant the athlete has already left: the reader is unmounted, the value
    // is still cached under its own page + filter key.
    const scope = effectScope()
    const left = scope.run(() =>
      useResource('t.paged:easy:1', () => fetcher('t.paged:easy:1'), { immediate: false }),
    )
    if (!left) throw new Error('reader not created inside the scope')
    await left.reload()
    scope.stop()

    const unrelated = useResource('t.outside', () => fetcher('t.outside'), { immediate: false })
    await unrelated.reload()
    expect(fetcher).toHaveBeenCalledTimes(3)

    invalidateResourcePrefix('t.paged:')

    // Only the variant on screen re-reads now; the one nobody is reading waits
    // for its next reader instead of being fetched in the background.
    await vi.waitFor(() => expect(visible.data.value).toMatchObject({ read: 2 }))
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(left.data.value).toMatchObject({ variant: 't.paged:easy:1', read: 1 })

    // …and that next reader is not served the invalidated value.
    expect(await left.reload()).toMatchObject({ variant: 't.paged:easy:1', read: 2 })
    expect(fetcher).toHaveBeenCalledTimes(5)

    // A key outside the prefix keeps its cached value.
    await unrelated.reload()
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('keeps the last good value when the invalidation re-read fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockRejectedValueOnce(new Error('offline'))
    const resource = useResource('t.offline', fetcher, { immediate: false })
    await resource.reload()

    invalidateResource('t.offline')

    await vi.waitFor(() => expect(resource.error.value).toBeInstanceOf(Error))
    expect(resource.data.value).toEqual({ n: 1 })
    expect(resource.loading.value).toBe(false)
  })

  it('still hard-clears for sign-out: the value goes and the next read refetches', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 })
    const resource = useResource('t.hard', fetcher, { immediate: false })
    await resource.reload()

    resetResource('t.hard')

    expect(resource.data.value).toBeNull()
    await resource.reload()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
