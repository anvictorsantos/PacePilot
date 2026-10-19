/**
 * Resource module — one cache and one loading/error surface for every read.
 *
 * Three composables used to clone the same cached-fetch control flow (a
 * module-level ref, a `pending` promise for in-flight dedupe, a `force` flag and
 * a swallowing `catch`), and each view repeated its own `loading` ref plus an
 * empty `catch`. Plan data was fetched independently by four routes, so
 * navigating re-requested identical endpoints.
 *
 * `useResource(key, fetcher)` is that one implementation: it dedupes concurrent
 * readers of the same key, keeps the last good value while re-reading
 * (stale-while-revalidate), and hands every caller the same `data / loading /
 * error / settled / reload` interface. Session, current user, capacity and the
 * read-only views are adapters over it.
 *
 * `key` may be a getter — a paged list keys itself by page and filter, and the
 * resource re-reads when that key changes.
 */
import { computed, getCurrentInstance, onMounted, ref, watch, type Ref } from 'vue'

import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

interface Entry<T> {
  data: T | null
  error: unknown
  promise: Promise<T | null> | null
  settled: boolean
}

const cache = new Map<string, Entry<unknown>>()

function entryFor<T>(key: string): Entry<T> {
  let entry = cache.get(key) as Entry<T> | undefined
  if (!entry) {
    entry = { data: null, error: null, promise: null, settled: false }
    cache.set(key, entry as unknown as Entry<unknown>)
  }
  return entry
}

/** Drop one key so the next reader re-reads it (`null` clears every key). */
export function resetResource(key?: string): void {
  if (key == null) cache.clear()
  else cache.delete(key)
}

/**
 * Drop every key starting with `prefix`. Paged lists key themselves by their
 * parameters (`activities:easy:2`), so one import invalidates an unknown set of
 * exact keys and a prefix is the only handle that covers them.
 */
export function resetResourcePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

export interface Resource<T> {
  /** Last successfully read value; survives a failed re-read. */
  data: Ref<T | null>
  loading: Ref<boolean>
  /** The failure from the last read, for callers that surface it. */
  error: Ref<unknown>
  /** True once a read has completed, successfully or not. */
  settled: Ref<boolean>
  /** Read again. `_force` re-reads even when a value is already cached. */
  reload(_force?: boolean): Promise<T | null>
}

export interface ResourceOptions {
  /**
   * Read on mount. Set `false` when the caller picks the moment — a router
   * guard, a user action, or a key that only becomes known later.
   */
  immediate?: boolean
}

export function useResource<T>(
  key: string | (() => string),
  fetcher: () => Promise<T>,
  options: ResourceOptions = {},
): Resource<T> {
  const { immediate = true } = options
  const resolveKey = typeof key === 'function' ? key : () => key
  const keyRef = computed(resolveKey)

  const first = entryFor<T>(keyRef.value)
  const data = ref(first.data) as Ref<T | null>
  const error = ref<unknown>(first.error)
  const settled = ref(first.settled)
  const loading = ref(!first.settled && immediate)
  let currentKey = keyRef.value

  function reload(force = false): Promise<T | null> {
    const resolved = keyRef.value
    const entry = entryFor<T>(resolved)
    // a new key means a different value entirely — drop the old one on screen
    if (resolved !== currentKey) {
      currentKey = resolved
      data.value = entry.data
      error.value = entry.error
      settled.value = entry.settled
    }
    // one request per key, however many callers ask for it — every caller
    // still gets the settled value in its own refs
    if (entry.promise) {
      loading.value = entry.data == null
      return entry.promise.then((result) => {
        if (resolved === currentKey) {
          data.value = result
          error.value = entry.error
          settled.value = true
          loading.value = false
        }
        return result
      })
    }
    if (entry.settled && !force) {
      data.value = entry.data
      error.value = entry.error
      settled.value = true
      loading.value = false
      return Promise.resolve(entry.data)
    }
    // keep the previous value on screen while re-reading
    loading.value = entry.data == null
    const run = fetcher()
      .then((result) => {
        entry.data = result
        entry.error = null
        if (resolved === currentKey) {
          data.value = result
          error.value = null
        }
        return result
      })
      .catch((err) => {
        entry.error = err
        if (resolved === currentKey) error.value = err
        recordRecoveredError(err, { feature: 'resource', operation: resolved })
        return null
      })
      .finally(() => {
        entry.promise = null
        entry.settled = true
        if (resolved === currentKey) {
          settled.value = true
          loading.value = false
        }
      })
    entry.promise = run
    return run
  }

  if (immediate && getCurrentInstance()) {
    onMounted(() => {
      void reload()
    })
  }

  // A getter key can change: re-read the newly addressed value. Only getter keys
  // get a watcher — a static key never changes, and a watcher created outside a
  // component (the router guard calls useSession on every navigation) never stops.
  if (typeof key === 'function') {
    watch(keyRef, () => {
      void reload()
    })
  }

  return {
    data,
    loading,
    error,
    settled,
    reload,
  }
}
