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
 * error / settled` interface. Session, current user, capacity and the
 * read-only views are adapters over it.
 *
 * Every caller of a key shares the entry's refs, so a read started by one
 * component (the shell fetching `/me`) is visible to every other component
 * reading the same key (the avatar, the initials, the menu label). Per-caller
 * copies of the refs used to leave the second reader on its initial `null`.
 *
 * `key` may be a getter — a paged list keys itself by page and filter, and the
 * resource re-reads when that key changes.
 */
import { computed, getCurrentInstance, onMounted, ref, watch, type Ref } from 'vue'

import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

interface Entry<T> {
  data: Ref<T | null>
  error: Ref<unknown>
  settled: Ref<boolean>
  loading: Ref<boolean>
  promise: Promise<T | null> | null
}

const cache = new Map<string, Entry<unknown>>()

function entryFor<T>(key: string): Entry<T> {
  let entry = cache.get(key) as Entry<T> | undefined
  if (!entry) {
    entry = {
      data: ref(null) as Ref<T | null>,
      error: ref(null),
      settled: ref(false),
      loading: ref(false),
      promise: null,
    }
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

  // Shared per key, and re-resolved on every access so a getter key returns the
  // refs of the key it currently addresses.
  const data = computed({
    get: () => entryFor<T>(keyRef.value).data.value,
    set: (value: T | null) => {
      entryFor<T>(keyRef.value).data.value = value
    },
  }) as Ref<T | null>
  const error = computed({
    get: () => entryFor<T>(keyRef.value).error.value,
    set: (value: unknown) => {
      entryFor<T>(keyRef.value).error.value = value
    },
  }) as Ref<unknown>
  const settled = computed({
    get: () => entryFor<T>(keyRef.value).settled.value,
    set: (value: boolean) => {
      entryFor<T>(keyRef.value).settled.value = value
    },
  }) as Ref<boolean>
  const loading = computed({
    get: () => entryFor<T>(keyRef.value).loading.value,
    set: (value: boolean) => {
      entryFor<T>(keyRef.value).loading.value = value
    },
  }) as Ref<boolean>

  // First render of an immediate reader shows the skeleton, even before
  // onMounted fires, as it did when each caller owned a fresh `loading` ref.
  const first = entryFor<T>(keyRef.value)
  if (immediate && !first.settled.value && first.data.value == null) first.loading.value = true

  function reload(force = false): Promise<T | null> {
    const resolved = keyRef.value
    const entry = entryFor<T>(resolved)
    // one request per key, however many callers ask for it — every caller
    // observes the same shared refs when it settles
    if (entry.promise) {
      entry.loading.value = entry.data.value == null
      return entry.promise
    }
    if (entry.settled.value && !force) return Promise.resolve(entry.data.value)
    // keep the previous value on screen while re-reading
    entry.loading.value = entry.data.value == null
    const run = fetcher()
      .then((result) => {
        entry.data.value = result
        entry.error.value = null
        return result
      })
      .catch((err) => {
        entry.error.value = err
        recordRecoveredError(err, { feature: 'resource', operation: resolved })
        return null
      })
      .finally(() => {
        entry.promise = null
        entry.settled.value = true
        entry.loading.value = false
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
