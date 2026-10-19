<template>
  <!-- notifications — centered modal with overlay -->
  <div>
    <button
      type="button"
      class="relative flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      :aria-label="$t('shell.notifications')"
      :aria-expanded="open ? 'true' : 'false'"
      @click="onBellClick"
    >
      <BellIcon cls="w-5 h-5" />
      <span
        v-if="newCount > 0"
        class="absolute right-1.5 top-1.5 flex h-2 w-2"
      >
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
        ></span>
        <span
          class="relative inline-flex h-2 w-2 rounded-full bg-primary ring-2 ring-background"
        ></span>
      </span>
    </button>

    <Teleport to="body">
      <Transition name="notif-fade">
        <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -- overlay closes on click; Escape is owned by useDialog while the modal is open -->
        <div
          v-if="open"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          @click.self="close"
        >
          <Transition
            name="notif-pop"
            appear
          >
            <div
              v-if="open"
              ref="dialog"
              v-bind="dialogAttrs"
              class="max-h-[85vh] w-full max-w-mid overflow-auto rounded-card border border-border bg-card text-ink"
            >
              <div class="flex items-start justify-between px-5 pt-4">
                <div>
                  <p
                    id="notifications-dialog-title"
                    class="font-bold text-body text-white"
                  >
                    {{ $t('notifications.title') }}
                  </p>
                  <p class="mt-0.5 text-caption text-muted">
                    {{
                      newCount > 0
                        ? newCount === 1
                          ? $t('notifications.unreadOne')
                          : $t('notifications.unreadOther', { n: newCount })
                        : $t('notifications.allCaughtUp')
                    }}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    v-if="newCount > 0"
                    type="button"
                    class="min-h-touch font-medium text-caption text-primaryBright transition hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    @click="bellSeen = true"
                  >
                    {{ $t('notifications.markAll') }}
                  </button>
                  <button
                    type="button"
                    :aria-label="$t('notifications.close')"
                    class="flex h-11 min-h-touch w-11 items-center justify-center rounded-full bg-cardSecondary text-white transition hover:bg-track focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    @click="close"
                  >
                    <XMarkIcon cls="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                v-if="bellLoading"
                class="px-5 py-8 text-center text-body text-muted"
              >
                {{ $t('common.loading') }}
              </div>
              <div
                v-else-if="!bellItems.length"
                class="px-5 py-8 text-center"
              >
                <p class="font-medium text-body text-white">{{ $t('notifications.empty') }}</p>
                <p class="mt-1 text-caption text-muted">
                  {{ $t('notifications.emptyDesc') }}
                </p>
              </div>
              <ul
                v-else
                class="max-h-80 divide-y divide-border overflow-auto px-2 pb-2"
              >
                <p
                  class="px-3 pb-1 pt-3 font-medium text-caption uppercase tracking-wide text-faint"
                >
                  {{ $t('shell.today') }}
                </p>
                <li
                  v-for="a in bellItems"
                  :key="(a.id || a.strava_activity_id) ?? undefined"
                  class="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-white/5"
                >
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-label text-white"
                    :class="intensityAvatarClass(a.workout_type || a.type)"
                  >
                    {{ (a.workout_type || a.type || 'R').slice(0, 1).toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-2">
                      <p class="min-w-0 flex-1 truncate font-bold text-body text-white">
                        {{ activityTitle(a) }}
                      </p>
                      <span class="shrink-0 text-caption text-muted">{{
                        formatShortDate(a.date || a.start_date)
                      }}</span>
                      <span
                        v-if="!bellSeen"
                        class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      ></span>
                    </div>
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      <span
                        class="rounded-md bg-track px-2 py-0.5 font-medium text-caption text-primaryBright"
                        >{{ paceFromActivity(a) }}</span
                      >
                      <span class="rounded-md bg-track px-2 py-0.5 text-caption text-muted">{{
                        timeFor(a) || displayDistance(a)
                      }}</span>
                    </div>
                    <p class="mt-1.5 truncate text-caption text-muted">
                      {{ displayDistance(a) }} · {{ formatDate(a.date || a.start_date) }}
                    </p>
                  </div>
                </li>
              </ul>

              <div class="border-t border-border p-2">
                <button
                  type="button"
                  class="flex w-full min-h-touch items-center justify-center rounded-lg bg-cardSecondary py-2 text-center font-medium text-body text-white transition hover:bg-track disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  :disabled="syncing"
                  @click="syncActivities"
                >
                  {{
                    syncing
                      ? $t('strava.sync.buttonInProgress')
                      : $t('notifications.syncActivities')
                  }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

import BellIcon from '@/components/icons/BellIcon.vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import {
  activityTitle as sharedActivityTitle,
  intensityAvatarClass,
  paceFromActivity,
} from '@/modules/shared/ui/training-vocabulary.ts'
import { useDialog } from '@/modules/shared/ui/useDialog.ts'
import { stravaModule } from '@/modules/strava/infrastructure/container/strava-container.ts'

// Moved verbatim from AppHeader (Pass 9: extract, no visual change).
// Same API calls: GET /activities perPage 10 on mount + 30s poll.

/** The rows this panel renders. `type` is the legacy alias the template falls
 *  back to (`a.workout_type || a.type`); the API never sends it, but declaring
 *  it keeps that existing expression type-safe. */
type BellActivity = Activity & { type?: string | null }

const props = defineProps({ lastSyncedAt: { type: String, default: '' } })

const bellItems = ref<BellActivity[]>([])
const bellLoading = ref(false)
const syncing = ref(false)
let bellFetched = false
const bellSeen = ref(false)
const open = ref(false)

const newCount = computed(() => (bellSeen.value ? 0 : bellItems.value.length))

function formatDate(s: string | null | undefined) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleString()
  } catch {
    return String(s)
  }
}
function formatShortDate(s: string | null | undefined) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString()
  } catch {
    return String(s)
  }
}
function displayDistance(a: BellActivity) {
  const km = a.distance_km ?? (a.distance != null ? (a.distance / 1000).toFixed(2) : null)
  return km != null ? `${km} km` : '—'
}
function activityTitle(a: BellActivity) {
  return sharedActivityTitle(a)
}
function timeFor(a: BellActivity) {
  if (a.moving_time_min) return `${a.moving_time_min} min`
  if (a.moving_time) return `${Math.round(a.moving_time / 60)} min`
  return ''
}

async function fetchBell(force = false) {
  if (bellFetched && !force) return
  bellLoading.value = true
  try {
    const data = await api.activities.list({ perPage: 10 })
    const items: BellActivity[] = data.items || []
    const cutoff = props.lastSyncedAt ? new Date(props.lastSyncedAt).getTime() : null
    const next = cutoff
      ? items.filter((a) => {
          const iso = a.date || a.start_date
          return iso ? new Date(iso).getTime() > cutoff : false
        })
      : items.slice(0, 6)
    // if new items arrived after dismissal, re-show the dot
    if (next.length && bellSeen.value && next.length !== bellItems.value.length)
      bellSeen.value = false
    else if (!bellSeen.value && next.length === 0) {
      /* keep hidden if nothing new */
    }
    bellItems.value = next
    bellFetched = true
  } catch {
    bellItems.value = []
  } finally {
    bellLoading.value = false
  }
}

function close() {
  open.value = false
}

/**
 * Import in place. The modal stays open and the list re-reads, so the new
 * activities appear under the button instead of sending the athlete to a page.
 * The use case already toasted the outcome; a failure must not close the panel.
 */
async function syncActivities() {
  syncing.value = true
  try {
    await stravaModule.sync.execute({ force: true })
    await fetchBell(true)
  } catch {
    // The notifier surfaced the reason; keep the panel usable.
  } finally {
    syncing.value = false
  }
}

const dialog = ref<HTMLElement | null>(null)
const { attrs: dialogAttrs } = useDialog(dialog, {
  active: open,
  labelledby: 'notifications-dialog-title',
  onEscape: close,
})

async function onBellClick() {
  if (!bellFetched) await fetchBell()
  open.value = true
  if (bellItems.value.length) bellSeen.value = true
}

let poll: ReturnType<typeof setInterval> | null = null
onMounted(async () => {
  // prefetch quietly so badge is accurate on load (dot shows before click)
  await fetchBell()
  // poll so a newly synced activity shows the dot without needing to click Refresh
  poll = setInterval(() => fetchBell(true), 30000)
})
onUnmounted(() => {
  if (poll) clearInterval(poll)
})
</script>

<style scoped>
.notif-fade-enter-active,
.notif-fade-leave-active {
  transition: opacity 0.2s ease;
}
.notif-fade-enter-from,
.notif-fade-leave-to {
  opacity: 0;
}
.notif-pop-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.notif-pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.notif-pop-enter-from,
.notif-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .notif-fade-enter-active,
  .notif-fade-leave-active,
  .notif-pop-enter-active,
  .notif-pop-leave-active {
    transition: none;
  }
  .notif-pop-enter-from,
  .notif-pop-leave-to {
    transform: none;
  }
}
</style>
