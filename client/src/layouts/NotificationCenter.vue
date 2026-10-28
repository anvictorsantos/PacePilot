<template>
  <!-- notifications — centered modal with overlay -->
  <div>
    <button
      type="button"
      class="relative flex justify-center items-center focus-visible:outline-hidden focus-visible:ring-2 w-11 h-11 text-muted hover:text-white transition cursor-pointer"
      :aria-label="bellLabel"
      :aria-expanded="open ? 'true' : 'false'"
      @click="onBellClick"
    >
      <BellIcon cls="w-5 h-5" />
      <!-- The dot is the visual half; `bellLabel` carries the count for anyone
           who cannot see it, so the state never rests on colour. -->
      <span
        v-if="hasUnread"
        class="top-1.5 right-1.5 absolute flex w-2 h-2"
        aria-hidden="true"
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
                    {{ subtitle }}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    v-if="hasUnread"
                    type="button"
                    class="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-medium text-caption text-primaryBright hover:text-primaryBright transition cursor-pointer"
                    @click="markAllRead"
                  >
                    {{ $t('notifications.markAll') }}
                  </button>
                  <button
                    type="button"
                    :aria-label="$t('notifications.close')"
                    class="flex justify-center items-center w-11 h-11 min-h-touch text-white transition cursor-pointer"
                    @click="close"
                  >
                    <XMarkIcon cls="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                v-if="loading"
                class="px-5 py-8 text-body text-muted text-center"
                aria-live="polite"
              >
                {{ $t('notifications.loading') }}
              </div>

              <div
                v-else-if="error && !activities.length"
                class="px-5 py-8 text-center"
                role="alert"
              >
                <p class="font-medium text-body text-white">
                  {{ $t('notifications.loadFailed') }}
                </p>
                <button
                  type="button"
                  class="mt-3 bg-cardSecondary hover:bg-track px-4 py-2 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-medium text-caption text-white transition cursor-pointer"
                  @click="retry"
                >
                  {{ $t('common.retry') }}
                </button>
              </div>

              <div
                v-else-if="!activities.length"
                class="px-5 py-8 text-center"
              >
                <p class="font-medium text-body text-white">{{ $t('notifications.empty') }}</p>
                <p class="mt-1 text-caption text-muted">
                  {{
                    connected
                      ? $t('notifications.emptyDesc')
                      : $t('notifications.emptyUnconnected', { provider: $t('providers.strava') })
                  }}
                </p>
              </div>

              <div v-else>
                <p
                  class="px-5 pt-3 pb-1 font-medium text-caption text-faint uppercase tracking-wide"
                >
                  {{ $t(headingKey) }}
                </p>
                <ul class="px-2 pb-2 divide-y divide-border max-h-80 overflow-auto">
                  <li
                    v-for="a in visible"
                    :key="itemKey(a)"
                    class="flex gap-3 hover:bg-white/5 px-3 py-3 rounded-xl transition"
                  >
                    <div
                      class="flex justify-center items-center rounded-full w-9 h-9 font-bold text-label text-white shrink-0"
                      :class="intensityAvatarClass(a.workout_type)"
                    >
                      {{ avatarLetter(a) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-baseline gap-2">
                        <p class="flex-1 min-w-0 font-bold text-body text-white truncate">
                          {{ activityTitle(a) }}
                        </p>
                        <span class="text-caption text-muted shrink-0">{{
                          formatShortDate(a.date || a.start_date)
                        }}</span>
                      </div>
                      <div class="flex flex-wrap gap-1.5 mt-1.5">
                        <span
                          v-if="hasUnread"
                          class="bg-primary/15 px-2 py-0.5 rounded-md font-medium text-caption text-primaryBright"
                          >{{ $t('notifications.newItem') }}</span
                        >
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
              </div>

              <div class="p-2 border-border border-t">
                <!-- A disconnected account cannot import: the sync use case
                     refuses before spending a provider request, so say why. -->
                <p
                  v-if="!connected"
                  id="notifications-disconnected"
                  class="mb-2 px-2 pt-1 text-caption leading-body text-dangerBright"
                >
                  {{ $t('notifications.disconnected', { provider: $t('providers.strava') }) }}
                  <RouterLink
                    to="/settings"
                    class="font-bold underline hover:text-white transition"
                    @click="close"
                  >
                    {{ $t('notifications.reconnect', { provider: $t('providers.strava') }) }}
                  </RouterLink>
                </p>
                <button
                  type="button"
                  class="flex justify-center items-center bg-cardSecondary hover:bg-track disabled:opacity-50 py-2 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary w-full min-h-touch font-medium text-body text-white text-center transition cursor-pointer disabled:cursor-not-allowed"
                  :disabled="syncing || !connected"
                  :aria-describedby="connected ? undefined : 'notifications-disconnected'"
                  @click="sync"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import BellIcon from '@/components/icons/BellIcon.vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'
import { useActivityFeed } from '@/modules/activities/infrastructure/composable/useActivityFeed.ts'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import {
  activityTitle as sharedActivityTitle,
  intensityAvatarClass,
  paceFromActivity,
} from '@/modules/shared/ui/training-vocabulary.ts'
import { useDialog } from '@/modules/shared/ui/useDialog.ts'

const { t } = useI18n()

/**
 * The feed reads what was imported since the athlete last looked; the module
 * owns that rule (`ActivityReadFeed`) and the per-account watermark, so this
 * panel only renders. There is no "last sync" input: a run always starts before
 * the sync that imported it, which is what used to keep this list empty.
 */
const {
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
} = useActivityFeed()

const open = ref(false)
const dialog = ref<HTMLElement | null>(null)
const { attrs: dialogAttrs } = useDialog(dialog, {
  active: open,
  labelledby: 'notifications-dialog-title',
  onEscape: close,
})

const bellLabel = computed(() =>
  unreadCount.value > 0
    ? t('notifications.bellUnread', { n: unreadCount.value })
    : t('shell.notifications'),
)

const subtitle = computed(() => {
  if (unreadCount.value === 0) return t('notifications.allCaughtUp')
  return unreadCount.value === 1
    ? t('notifications.unreadOne')
    : t('notifications.unreadOther', { n: unreadCount.value })
})

function itemKey(a: Activity): string {
  return String(a.id ?? a.provider_activity_id ?? a._id ?? a.date ?? '')
}

function avatarLetter(a: Activity): string {
  return (a.workout_type || 'r').slice(0, 1).toUpperCase()
}

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
function displayDistance(a: Activity) {
  const km = a.distance_km ?? (a.distance != null ? (a.distance / 1000).toFixed(2) : null)
  return km != null ? `${km} km` : '—'
}
function activityTitle(a: Activity) {
  return sharedActivityTitle(a)
}
function timeFor(a: Activity) {
  if (a.moving_time_min) return `${a.moving_time_min} min`
  if (a.moving_time) return `${Math.round(a.moving_time / 60)} min`
  return ''
}

function close() {
  open.value = false
}

/**
 * Open on the freshest list. The read watermark is not touched here: the rows
 * the athlete has not seen stay unread until they say so, and a sync running
 * behind the panel can only add to them.
 */
function onBellClick() {
  retry()
  open.value = true
}
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
