// One cache and loading/error surface per read key: concurrent readers share one
// request, every caller shares the entry's refs, the newest `seq` owns the write.
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
  /** The newest read requested for this key; older ones land nowhere. */
  seq: number
  /** The fetcher of the readers of this key, so an invalidation can re-read it. */
  fetcher: (() => Promise<T>) | null
  /** How many live readers address this key; zero means nobody is on screen. */
  readers: number
  /** Invalidated: the value is still readable, but the next read hits the network. */
  stale: boolean
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
      seq: 0,
      fetcher: null,
      readers: 0,
      stale: false,
    }
    cache.set(key, entry as unknown as Entry<unknown>)
  }
  return entry
}

// One request per entry however many callers ask; a superseded read lands nowhere
// and hands back what the newest one wrote.
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

// Empty in place: deleting the map entry would leave mounted readers on the old
// refs, so the entry stays registered and only the answer goes.
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

// Hard clear for an identity boundary (sign-out, erasure): on-screen readers lose
// the value too. `null` clears every key.
export function resetResource(key?: string): void {
  if (key == null) {
    for (const entry of cache.values()) clearEntry(entry)
    return
  }
  const entry = cache.get(key)
  if (entry) clearEntry(entry)
}

// Paged lists key by their parameters (`activities:easy:2`), so a prefix is the
// only handle on an unknown set of exact keys.
export function resetResourcePrefix(prefix: string): void {
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix)) clearEntry(entry)
  }
}

// Mark stale and re-read under the reader on screen, which keeps its last good
// value. Resolves once that re-read lands, so a caller about to reveal a screen awaits it.
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

// Wait out a read that predates the invalidation, then re-read — unless a later
// read already took the entry over, because that one is the refresh.
async function refreshEntry<T>(entry: Entry<T>, key: string): Promise<void> {
  while (entry.promise) await entry.promise
  if (!entry.stale || entry.readers === 0) return
  await readEntry(entry, key)
}

// Disown an in-flight read for `key`, for a fact the older request could not know
// (a provider link completed). Unforced re-reads still share one request.
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
  error: Ref<unknown>
  /** True once a read has completed, successfully or not. */
  settled: Ref<boolean>
  /** Read again. `_force` re-reads even when a value is already cached. */
  reload(_force?: boolean): Promise<T | null>
}

export interface ResourceOptions {
  // Read on mount. Set `false` when the caller picks the moment — a router guard,
  // a user action, or a key that only becomes known later.
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

  // Register this caller: the fetcher an invalidation re-reads with, and the
  // liveness count that decides eager re-read vs stale-only.
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
    // A caller created outside a component scope (the router guard's `useAuth`)
    // never disposes, so counting it would pin the key on screen forever.
    if (!scoped || countedEntry === entry) return
    unregister()
    entry.readers += 1
    countedEntry = entry
  }
  register()

  // First render of an immediate reader shows the skeleton before onMounted fires.
  const first = entryFor<T>(keyRef.value)
  if (immediate && !first.settled.value && first.data.value == null) first.loading.value = true

  function reload(force = false): Promise<T | null> {
    register()
    const entry = entryFor<T>(keyRef.value)
    // One request per key however many callers ask; to override a request already
    // in flight, call `supersedeResource` first.
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

  // Only getter keys get a watcher: a static key never changes, and a watcher
  // created outside a component (the router guard) never stops.
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
