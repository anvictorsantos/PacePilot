// The selection rule lives in `ActivityReadFeed`; this module supplies the signed-in
// account, its watermark storage and a re-read after an import.
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
 * Account erasure: exported on its own so a teardown path does not have to mount
 * the whole feed to drop one key.
 */
export function forgetActivityReadWatermark(accountId: string | null | undefined): void {
  if (accountId) watermarks.clear(accountId)
}

export function useActivityFeed() {
  const { user } = useAuth()
  const { connected } = useConnection()

  // Without an account there is no per-account key, so the feed stays quiet rather
  // than writing a watermark that would belong to nobody.
  const accountId = computed(() => user.value?.id ?? null)
  // A value object is immutable, so it wants shallow reactivity: `ref` would proxy
  // it and strip the private field that makes the rule meaningful.
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

  const visible = computed(() => (hasUnread.value ? unread.value : recent.value))
  const headingKey = computed(() =>
    hasUnread.value ? 'notifications.unreadHeading' : 'notifications.recentTitle',
  )

  watch(
    accountId,
    (id) => {
      watermark.value = id ? watermarks.load(id) : ActivityReadWatermark.never()
    },
    { immediate: true },
  )

  /**
   * Only an explicit mark-all-read advances the watermark: a sync, a poll or
   * opening the panel must not swallow rows the athlete has not seen.
   */
  function markAllRead(): void {
    const id = accountId.value
    const latest = feed.value.latestImportInstant
    // Nothing unread means no instant to stamp: never write a clock reading.
    if (!id || !latest) return
    const stamped = ActivityReadWatermark.covering([latest])
    watermark.value = stamped
    watermarks.save(id, stamped)
  }

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

  // Polling lives here, not in the view: the bell has to light for an import that
  // landed while the panel was closed.
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
