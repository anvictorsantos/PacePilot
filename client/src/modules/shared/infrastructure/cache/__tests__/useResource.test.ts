// Tested through the interface only: a reader created inside an `effectScope` is a
// view on screen, one created outside (router guard, module-level refresh) is not.
import { describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope, ref } from 'vue'

import {
  invalidateResource,
  invalidateResourcePrefix,
  resetResource,
  resetResourcePrefix,
  supersedeResource,
  useResource,
  type Resource,
} from '@/modules/shared/infrastructure/cache/useResource.ts'

function mounted<T>(
  key: string,
  fetcher: () => Promise<T>,
): { reader: Resource<T>; scope: EffectScope } {
  const scope = effectScope()
  const reader = scope.run(() => useResource<T>(key, fetcher, { immediate: false }))
  if (!reader) throw new Error('reader not created inside the scope')
  return { reader, scope }
}

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
    // The shell, the avatar and the menu label each read /me; per-caller refs left
    // two of them on null.
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

  it('drops a request already in flight so the next read is the one that counts', async () => {
    let releaseStale: (value: { n: number }) => void = () => {}
    const stale = new Promise<{ n: number }>((resolve) => {
      releaseStale = resolve
    })
    const fetcher = vi.fn().mockReturnValueOnce(stale).mockResolvedValueOnce({ n: 2 })
    const resource = useResource('t.supersede', fetcher, { immediate: false })

    const early = resource.reload()
    // The app learned a fact the early request could not have known.
    supersedeResource('t.supersede')
    await resource.reload()

    expect(resource.data.value).toEqual({ n: 2 })
    releaseStale({ n: 1 })
    await early

    // The stale answer arrived last but was asked for first: it must not win.
    expect(resource.data.value).toEqual({ n: 2 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('empties a key on reset so the next reader re-reads it', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 })
    const resource = useResource('t.reset', fetcher, { immediate: false })
    await resource.reload()

    resetResource('t.reset')
    await resource.reload()

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('empties every paged key under a prefix', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true })
    const first = useResource('t.list:all:1', fetcher, { immediate: false })
    const page2 = useResource('t.list:all:2', fetcher, { immediate: false })
    const other = useResource('t.other', fetcher, { immediate: false })
    await Promise.all([first.reload(), page2.reload(), other.reload()])

    resetResourcePrefix('t.list:')
    await Promise.all([first.reload(), page2.reload(), other.reload()])

    expect(fetcher).toHaveBeenCalledTimes(5)
  })
})

describe('useResource hard clear', () => {
  it('empties a mounted reader in place, and its next read still fetches', async () => {
    const fetcher = vi.fn().mockResolvedValue({ email: 'first@example.com' })
    const { reader } = mounted('t.cleared', fetcher)
    await reader.reload()
    // Evaluated before the clear, as a rendered view would: they hold the entry's
    // refs, not a fresh lookup.
    expect(reader.data.value).toEqual({ email: 'first@example.com' })
    expect(reader.settled.value).toBe(true)

    resetResource('t.cleared')

    // Deleting the map entry left the old value here: the computed kept evaluating
    // the old refs, so the clear runs in place.
    expect(reader.data.value).toBeNull()
    expect(reader.settled.value).toBe(false)
    expect(reader.error.value).toBeNull()
    expect(reader.loading.value).toBe(false)

    expect(await reader.reload()).toEqual({ email: 'first@example.com' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('empties the value without dropping the fetcher an invalidation re-reads with', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })
    const { reader } = mounted('t.clear-then-invalidate', fetcher)
    await reader.reload()

    resetResource('t.clear-then-invalidate')
    invalidateResource('t.clear-then-invalidate')

    await vi.waitFor(() => expect(reader.data.value).toEqual({ n: 2 }))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('disowns the read on the wire, so a pre-sign-out answer lands nowhere', async () => {
    let release: (value: { athlete: string }) => void = () => {}
    const inFlight = new Promise<{ athlete: string }>((resolve) => {
      release = resolve
    })
    const fetcher = vi.fn().mockReturnValueOnce(inFlight).mockResolvedValueOnce({ athlete: 'next' })
    const { reader } = mounted('t.clear-inflight', fetcher)

    const early = reader.reload()
    // Sign-out happens while the previous account's read is still on the wire.
    resetResource('t.clear-inflight')
    release({ athlete: 'previous' })
    await early

    expect(reader.data.value).toBeNull()
    expect(reader.settled.value).toBe(false)

    // The next account's read is a fresh request and owns the entry.
    expect(await reader.reload()).toEqual({ athlete: 'next' })
    expect(reader.data.value).toEqual({ athlete: 'next' })
  })

  it('empties every key and prefix when called without one', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true })
    const one = useResource('t.all:a', fetcher, { immediate: false })
    const two = useResource('t.all:b', fetcher, { immediate: false })
    await Promise.all([one.reload(), two.reload()])

    resetResource()

    expect(one.data.value).toBeNull()
    expect(two.data.value).toBeNull()
  })
})

describe('useResource reader liveness', () => {
  it('does not count a caller created outside a scope as a reader', async () => {
    // The router guard and module-level refreshes call in outside a component;
    // counting them pinned the key as on screen for the whole session.
    const fetcher = vi.fn().mockResolvedValue({ ok: true })
    const outside = useResource('t.outside-scope', fetcher, { immediate: false })
    await outside.reload()

    await invalidateResource('t.outside-scope')

    // Nothing is on screen, so the invalidation only marks the entry stale.
    expect(fetcher).toHaveBeenCalledTimes(1)

    expect(await outside.reload(true)).toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('useResource invalidation', () => {
  it('keeps the last good value on screen while the invalidation refreshes it', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })
    const { reader } = mounted('t.invalidate', fetcher)
    await reader.reload()

    invalidateResource('t.invalidate')

    expect(reader.data.value).toEqual({ n: 1 })
    await vi.waitFor(() => expect(reader.data.value).toEqual({ n: 2 }))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('refreshes once per invalidation however many readers share the key', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })
    const first = mounted('t.once', fetcher)
    const second = mounted('t.once', fetcher)
    await Promise.all([first.reader.reload(), second.reader.reload()])
    expect(fetcher).toHaveBeenCalledTimes(1)

    invalidateResource('t.once')

    await vi.waitFor(() => expect(second.reader.data.value).toEqual({ n: 2 }))
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(first.reader.data.value).toEqual({ n: 2 })
  })

  it('covers every cached variant of a paged set, on screen or not', async () => {
    const reads = new Map<string, number>()
    const fetcher = vi.fn((variant: string) => {
      const read = (reads.get(variant) ?? 0) + 1
      reads.set(variant, read)
      return Promise.resolve({ variant, read })
    })
    const visible = mounted('t.paged:all:2', () => fetcher('t.paged:all:2'))
    await visible.reader.reload()

    // A variant the athlete already left: unmounted reader, value still cached
    // under its page + filter key.
    const left = mounted('t.paged:easy:1', () => fetcher('t.paged:easy:1'))
    await left.reader.reload()
    left.scope.stop()

    const unrelated = useResource('t.outside', () => fetcher('t.outside'), { immediate: false })
    await unrelated.reload()
    expect(fetcher).toHaveBeenCalledTimes(3)

    invalidateResourcePrefix('t.paged:')

    // Only the variant on screen re-reads; the one nobody reads waits for its next
    // reader instead of being fetched in the background.
    await vi.waitFor(() => expect(visible.reader.data.value).toMatchObject({ read: 2 }))
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(left.reader.data.value).toMatchObject({ variant: 't.paged:easy:1', read: 1 })

    // …and that next reader is not served the invalidated value.
    expect(await left.reader.reload()).toMatchObject({ variant: 't.paged:easy:1', read: 2 })
    expect(fetcher).toHaveBeenCalledTimes(5)

    await unrelated.reload()
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('keeps the last good value when the invalidation re-read fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockRejectedValueOnce(new Error('offline'))
    const { reader } = mounted('t.offline', fetcher)
    await reader.reload()

    invalidateResource('t.offline')

    await vi.waitFor(() => expect(reader.error.value).toBeInstanceOf(Error))
    expect(reader.data.value).toEqual({ n: 1 })
    expect(reader.loading.value).toBe(false)
  })
})
