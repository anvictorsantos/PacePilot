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
 *
 * Invalidation and clearing are different operations. `invalidateResource` marks
 * the entry stale and refreshes it under the reader that is on screen: the view
 * keeps its last good value rather than falling back to a skeleton because the
 * entry was deleted underneath it. `resetResource` is the hard clear for a
 * boundary — sign-out, account erasure — where the answer must go at once,
 * including from the readers already mounted.
 *
 * Two reads of one key can overlap (a poll, an invalidation under a slow
 * network). The entry's `seq` decides who writes the result, not arrival order:
 * the newest request owns the entry and the rest land nowhere.
 */
import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  onScopeDispose,
  ref,
  watch,
  type Ref,
} from 'vue'

import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

interface Entry<T> {
  data: Ref<T | null>
  error: Ref<unknown>
  settled: Ref<boolean>
  loading: Ref<boolean>
  promise: Promise<T | null> | null
  /** The fetcher of the readers of this key, so an invalidation can re-read it. */
  fetcher: (() => Promise<T>) | null
  /** How many live readers address this key; zero means nobody is on screen. */
  readers: number
  /** Invalidated: the value is still readable, but the next read hits the network. */
  stale: boolean
  /** The newest read requested for this key; older ones land nowhere. */
  seq: number
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
      fetcher: null,
      readers: 0,
      stale: false,
      seq: 0,
    }
    cache.set(key, entry as unknown as Entry<unknown>)
  }
  return entry
}

/**
 * Read one entry with its own fetcher. One request per entry, however many
 * callers ask for it, and the previous value stays on screen while it runs.
 *
 * A read that started earlier can resolve later (a status poll, a slow
 * network). The sequence is what decides who writes the result, not arrival
 * order: the newest request owns the entry, the rest land nowhere.
 */
function readEntry<T>(entry: Entry<T>, key: string): Promise<T | null> {
  if (entry.promise) {
    entry.loading.value = entry.data.value == null
    return entry.promise
  }
  const fetcher = entry.fetcher
  if (!fetcher) return Promise.resolve(entry.data.value)
  entry.stale = false
  entry.loading.value = entry.data.value == null
  const seq = ++entry.seq
  const run = fetcher()
    .then((result) => {
      if (seq !== entry.seq) return entry.data.value
      entry.data.value = result
      entry.error.value = null
      return result
    })
    .catch((err) => {
      if (seq === entry.seq) {
        entry.error.value = err
        recordRecoveredError(err, { feature: 'resource', operation: key })
      }
      return null
    })
    .finally(() => {
      // A superseded read must not clear the promise of the read that replaced it.
      if (seq !== entry.seq) return
      entry.promise = null
      entry.settled.value = true
      entry.loading.value = false
    })
  entry.promise = run
  return run
}

/**
 * Empty one entry in place.
 *
 * A hard clear has to reach the readers already mounted. A reader's `data`,
 * `settled` and `loading` computeds resolve the entry's refs, so deleting the map
 * entry only makes the next `entryFor` create a *new* entry: the mounted reader
 * keeps evaluating the old refs and the old value stays on screen. The entry
 * therefore stays registered — with its fetcher and its reader count — and only
 * the answer goes.
 */
function clearEntry<T>(entry: Entry<T>): void {
  // A read on the wire started before the boundary: disown it, so its answer
  // lands nowhere instead of writing into the cleared entry.
  entry.seq += 1
  entry.promise = null
  entry.data.value = null
  entry.error.value = null
  entry.settled.value = false
  entry.loading.value = false
  entry.stale = false
}

/**
 * Empty one key so the next reader re-reads it (`null` empties every key).
 *
 * The hard clear: a mounted reader loses its value too, without remounting. Use
 * it only where the identity behind the cache changes — sign-out, account
 * erasure — because every on-screen reader falls back to its empty state.
 */
export function resetResource(key?: string): void {
  if (key == null) {
    for (const entry of cache.values()) clearEntry(entry)
    return
  }
  const entry = cache.get(key)
  if (entry) clearEntry(entry)
}

/**
 * Empty every key starting with `prefix`, the hard clear for a paged set. Paged
 * lists key themselves by their parameters (`activities:easy:2`), so a prefix is
 * the only handle that covers an unknown set of exact keys.
 */
export function resetResourcePrefix(prefix: string): void {
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix)) clearEntry(entry)
  }
}

/**
 * Refresh one key in place: the entry keeps its last good value, and the reader
 * already on screen re-reads once. A cached key nobody is reading is only
 * marked stale, so its next reader re-reads it instead of serving the value the
 * invalidation was meant to replace.
 *
 * Resolves once the re-read it started has landed — or straight away when there
 * was nothing to re-read. A caller that is about to reveal a screen (the connect
 * flow hands control to the destination view) awaits it, so the screen renders
 * the refreshed value instead of the one the invalidation was meant to replace.
 */
export function invalidateResource(key: string): Promise<void> {
  return invalidateEntry(cache.get(key), key)
}

/** `invalidateResource` for every cached variant of a paged or filtered set. */
export function invalidateResourcePrefix(prefix: string): Promise<void> {
  const reads: Promise<void>[] = []
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix)) reads.push(invalidateEntry(entry, key))
  }
  return Promise.all(reads).then(() => undefined)
}

function invalidateEntry<T>(entry: Entry<T> | undefined, key: string): Promise<void> {
  if (!entry) return Promise.resolve()
  entry.stale = true
  // Nothing has been read yet: the first read will fetch it anyway.
  if (entry.readers === 0) return Promise.resolve()
  return refreshEntry(entry, key)
}

/**
 * Read once the entry is free. A read already on the wire started before the
 * fact behind the invalidation, so its answer cannot be the refreshed one: wait
 * for it, then read again — unless a read that started later took the entry over,
 * because that one did start after the fact and is the refresh.
 */
async function refreshEntry<T>(entry: Entry<T>, key: string): Promise<void> {
  while (entry.promise) await entry.promise
  if (!entry.stale || entry.readers === 0) return
  await readEntry(entry, key)
}

/**
 * Disown a read that is already in flight for `key`. The next reader starts a
 * fresh request, and the abandoned response now belongs to nobody — it cannot
 * overwrite a newer answer that happened to arrive first.
 *
 * Used where the app learns a fact the older request could not have known (a
 * provider link completed), rather than on every forced re-read: two callers
 * asking for the same key at the same moment still share one request.
 */
export function supersedeResource(key: string): void {
  const entry = cache.get(key)
  if (!entry) return
  entry.seq += 1
  entry.promise = null
  entry.loading.value = false
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

  // Register this caller against the key it currently addresses: the fetcher an
  // invalidation re-reads with, and the liveness count that decides whether an
  // invalidation re-reads eagerly or only marks the entry stale.
  const scoped = Boolean(getCurrentScope())
  let countedEntry: Entry<T> | null = null
  function unregister(): void {
    if (countedEntry) countedEntry.readers = Math.max(0, countedEntry.readers - 1)
    countedEntry = null
  }
  function register(): void {
    const entry = entryFor<T>(keyRef.value)
    // The fetcher belongs to this read, not to a mounted view: an invalidation
    // re-reads with it whether or not this caller is on screen.
    entry.fetcher = fetcher
    // A caller created outside a component scope (the router guard's `useAuth`,
    // a module-level refresh) never disposes, so counting it would pin the key as
    // "on screen" forever and an invalidation would re-read for nobody.
    if (!scoped || countedEntry === entry) return
    unregister()
    entry.readers += 1
    countedEntry = entry
  }
  register()

  // First render of an immediate reader shows the skeleton, even before
  // onMounted fires, as it did when each caller owned a fresh `loading` ref.
  const first = entryFor<T>(keyRef.value)
  if (immediate && !first.settled.value && first.data.value == null) first.loading.value = true

  function reload(force = false): Promise<T | null> {
    register()
    const entry = entryFor<T>(keyRef.value)
    if (entry.promise) {
      entry.loading.value = entry.data.value == null
      return entry.promise
    }
    if (entry.settled.value && !force && !entry.stale) return Promise.resolve(entry.data.value)
    return readEntry(entry, keyRef.value)
  }

  if (immediate && getCurrentInstance()) {
    onMounted(() => {
      void reload()
    })
  }

  // A getter key can change: re-read the newly addressed value. Only getter keys
  // get a watcher — a static key never changes, and a watcher created outside a
  // component (the router guard calls useConnection on every navigation) never stops.
  if (typeof key === 'function') {
    watch(keyRef, () => {
      void reload()
    })
  }

  // A component that unmounts no longer holds the key on screen; the value stays
  // cached, and an invalidation after that only marks it stale.
  if (getCurrentScope()) {
    onScopeDispose(unregister)
  }

  return {
    data,
    loading,
    error,
    settled,
    reload,
  }
}
