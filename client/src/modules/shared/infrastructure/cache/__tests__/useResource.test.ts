/**
 * The Resource module is the seam every read crosses: cache, in-flight dedupe,
 * stale-while-revalidate and the error surface. Tested through its interface —
 * no component, no mount — because that is what callers and tests share.
 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
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
