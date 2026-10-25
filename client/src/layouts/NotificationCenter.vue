<template>
  <!-- notifications — centered modal with overlay -->
  <div>
    <button
      type="button"
      class="cursor-pointer relative flex justify-center items-center hover:bg-white/5 rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary w-11 h-11 text-muted hover:text-white transition"
      :aria-label="$t('shell.notifications')"
      :aria-expanded="open ? 'true' : 'false'"
      @click="onBellClick"
    >
      <BellIcon cls="w-5 h-5" />
      <span
        v-if="newCount > 0"
        class="top-1.5 right-1.5 absolute flex w-2 h-2"
      >
        <span
          class="inline-flex absolute bg-primary opacity-75 rounded-full w-full h-full animate-ping"
        ></span>
        <span
          class="inline-flex relative bg-primary rounded-full ring-2 ring-background w-2 h-2"
        ></span>
      </span>
    </button>

    <Teleport to="body">
      <Transition name="notif-fade">
        <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -- overlay closes on click; Escape is owned by useDialog while the modal is open -->
        <div
          v-if="open"
          class="z-50 fixed inset-0 flex justify-center items-center bg-black/70 p-4"
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
              class="bg-card border border-border rounded-card w-full max-w-mid max-h-[85vh] overflow-auto text-ink"
            >
              <div class="flex justify-between items-start px-5 pt-4">
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
                    class="cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-medium text-caption text-primaryBright hover:text-primary transition"
                    @click="bellSeen = true"
                  >
                    {{ $t('notifications.markAll') }}
                  </button>
                  <button
                    type="button"
                    :aria-label="$t('notifications.close')"
                    class="flex justify-center items-center bg-cardSecondary hover:bg-track rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary w-11 h-11 min-h-touch text-white transition cursor-pointer"
                    @click="close"
                  >
                    <XMarkIcon cls="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                v-if="bellLoading"
                class="px-5 py-8 text-body text-muted text-center"
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
                class="px-2 pb-2 divide-y divide-border max-h-80 overflow-auto"
              >
                <p
                  class="px-3 pt-3 pb-1 font-medium text-caption text-faint uppercase tracking-wide"
                >
                  {{ $t('shell.today') }}
                </p>
                <li
                  v-for="a in bellItems"
                  :key="(a.id || a.provider_activity_id) ?? undefined"
                  class="flex gap-3 hover:bg-white/5 px-3 py-3 rounded-xl transition"
                >
                  <div
                    class="flex justify-center items-center rounded-full w-9 h-9 font-bold text-label text-white shrink-0"
                    :class="intensityAvatarClass(a.workout_type || a.type)"
                  >
                    {{ (a.workout_type || a.type || 'R').slice(0, 1).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <p class="flex-1 min-w-0 font-bold text-body text-white truncate">
                        {{ activityTitle(a) }}
                      </p>
                      <span class="text-caption text-muted shrink-0">{{
                        formatShortDate(a.date || a.start_date)
                      }}</span>
                      <span
                        v-if="!bellSeen"
                        class="bg-primary rounded-full w-1.5 h-1.5 shrink-0"
                        aria-hidden="true"
                      ></span>
                    </div>
                    <div class="flex flex-wrap gap-1.5 mt-1.5">
                      <span
                        class="bg-track px-2 py-0.5 rounded-md font-medium text-caption text-primaryBright"
                        >{{ paceFromActivity(a) }}</span
                      >
                      <span class="bg-track px-2 py-0.5 rounded-md text-caption text-muted">{{
                        timeFor(a) || displayDistance(a)
                      }}</span>
                    </div>
                    <p class="mt-1.5 text-caption text-muted truncate">
                      {{ displayDistance(a) }} · {{ formatDate(a.date || a.start_date) }}
                    </p>
                  </div>
                </li>
              </ul>

              <div class="p-2 border-border border-t">
                <button
                  type="button"
                  class="flex justify-center items-center bg-cardSecondary hover:bg-track disabled:opacity-50 py-2 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary w-full min-h-touch font-medium text-body text-white text-center transition cursor-pointer disabled:cursor-not-allowed"
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
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import {
  activityTitle as sharedActivityTitle,
  intensityAvatarClass,
  paceFromActivity,
} from '@/modules/shared/ui/training-vocabulary.ts'
import { useDialog } from '@/modules/shared/ui/useDialog.ts'

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
    await connectionsModule.sync.execute({ force: true })
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
