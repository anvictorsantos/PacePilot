/**
 * The notification panel's state: the newest activities, the account's read
 * watermark, and what counts as new.
 *
 * The selection rule itself is `ActivityReadFeed` in the domain — this module
 * only supplies the three things the rule cannot know: which account is signed
 * in, where that account's watermark lives, and how to re-read the page after an
 * import. The panel below it renders.
 */
import { computed, getCurrentInstance, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

import { ActivityReadFeed } from '@/modules/activities/domain/value-object/ActivityReadFeed.ts'
import { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark.ts'
import type { ActivitiesResponse } from '@/modules/activities/infrastructure/dto/ActivitiesResponse.ts'
import { LocalStorageActivityReadWatermarkRepository } from '@/modules/activities/infrastructure/repository/LocalStorageActivityReadWatermarkRepository.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'
import { useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

/** Rows read per look; the server sorts by start date, newest first. */
export const FEED_PAGE_SIZE = 10

/** The panel refreshes itself so a background import lights the bell. */
export const FEED_POLL_MS = 30_000

// One watermark per browser, read through the resource key below per account.
const watermarks = new LocalStorageActivityReadWatermarkRepository()

/**
 * Account erasure: the read history goes with the account. Exported on its own
 * so a teardown path does not have to mount the whole feed to drop one key.
 */
export function forgetActivityReadWatermark(accountId: string | null | undefined): void {
  if (accountId) watermarks.clear(accountId)
}

export function useActivityFeed() {
  const { user } = useAuth()
  const { connected } = useConnection()

  // The account is the JWT's athlete, delivered with the session read. Without
  // it there is no per-account key, so the feed stays quiet rather than writing
  // a watermark that would belong to nobody.
  const accountId = computed(() => user.value?.id ?? null)
  // A value object is immutable, so it wants shallow reactivity: `ref` would
  // proxy it and strip the private field that makes the rule meaningful.
  const watermark = shallowRef(ActivityReadWatermark.never())
  const syncing = ref(false)

  const { data, loading, error, reload } = useResource<ActivitiesResponse>(
    () => `activities:bell:${accountId.value ?? 'signed-out'}`,
    () =>
      accountId.value
        ? api.activities.list({ perPage: FEED_PAGE_SIZE })
        : Promise.resolve({ items: [], total: 0 }),
  )

  const activities = computed(() => data.value?.items ?? [])
  const feed = computed(() =>
    ActivityReadFeed.of(activities.value, watermark.value, FEED_PAGE_SIZE),
  )
  const unread = computed(() => feed.value.unread)
  const recent = computed(() => feed.value.recent)
  const hasUnread = computed(() => feed.value.hasUnread)
  const unreadCount = computed(() => feed.value.unreadCount)

  /** What the list renders: the new rows, or the newest rows when none are new. */
  const visible = computed(() => (hasUnread.value ? unread.value : recent.value))
  const headingKey = computed(() =>
    hasUnread.value ? 'notifications.unreadHeading' : 'notifications.recentTitle',
  )

  // A page reload re-reads the same key; a different account reads its own.
  watch(
    accountId,
    (id) => {
      watermark.value = id ? watermarks.load(id) : ActivityReadWatermark.never()
    },
    { immediate: true },
  )

  /**
   * Stamp the watermark. The feed never advances it on its own: a sync that
   * imports, a poll, or opening the panel must not silently swallow the rows the
   * athlete has not seen yet.
   */
  function markAllRead(): void {
    const id = accountId.value
    if (!id) return
    const stamped = ActivityReadWatermark.covering([feed.value.latestImportInstant], new Date())
    watermark.value = stamped
    watermarks.save(id, stamped)
  }

  /** Import in place; the panel stays open and re-reads the page underneath. */
  async function sync(): Promise<void> {
    if (!connected.value || syncing.value) return
    syncing.value = true
    try {
      await connectionsModule.sync.execute({ force: true })
      await reload(true)
    } catch {
      // The sync notifier toasted the reason; the panel stays usable.
    } finally {
      syncing.value = false
    }
  }

  function retry(): void {
    void reload(true)
  }

  // Polling belongs to the module, not the view: the bell has to light for an
  // import that landed while the panel was closed.
  if (getCurrentInstance()) {
    let poll: ReturnType<typeof setInterval> | null = null
    onMounted(() => {
      poll = setInterval(() => void reload(true), FEED_POLL_MS)
    })
    onUnmounted(() => {
      if (poll) clearInterval(poll)
    })
  }

  return {
    loading,
    error,
    activities,
    visible,
    headingKey,
    hasUnread,
    unreadCount,
    connected,
    syncing,
    markAllRead,
    sync,
    retry,
  }
}
