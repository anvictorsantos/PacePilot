<template>
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
                  id="strava-dialog-title"
                  class="font-bold text-body text-white"
                >
                  {{ $t('auth.connectModal.title') }}
                </p>
                <p class="mt-0.5 text-caption text-muted">
                  {{ $t('auth.connectModal.subtitle') }}
                </p>
              </div>
              <button
                type="button"
                :aria-label="$t('auth.connectModal.close')"
                class="flex h-11 min-h-touch w-11 items-center justify-center rounded-full bg-cardSecondary text-white transition hover:bg-track focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                @click="close"
              >
                <XMarkIcon cls="h-4 w-4" />
              </button>
            </div>

            <div
              class="flex flex-col items-center gap-3 px-5 py-8 text-center"
              aria-live="polite"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-full"
                :class="status === 'connected' ? 'bg-success/15' : brand.iconTileClass"
              >
                <CheckCircleIcon
                  v-if="status === 'connected'"
                  cls="h-6 w-6 text-success"
                />
                <component
                  :is="brand.icon"
                  v-else
                  cls="h-6 w-6"
                  :class="brand.iconClass"
                />
              </div>

              <p class="font-bold text-lead text-white">
                {{ title }}
              </p>
              <p
                v-if="status === 'connected'"
                class="text-body text-muted"
              >
                {{ $t('auth.connectModal.connectedDesc', { seconds: secondsLeft }) }}
              </p>
              <p
                v-else-if="status === 'error'"
                class="text-body text-muted"
              >
                {{ errorMessage }}
              </p>
              <p
                v-else
                class="text-body text-muted"
              >
                {{ $t('auth.connectModal.waitingDesc') }}
              </p>

              <p
                v-if="status === 'waiting'"
                class="text-caption text-faint"
              >
                {{ $t('auth.connectModal.waitingHint') }}
              </p>
            </div>

            <div class="border-t border-border p-2">
              <button
                v-if="status === 'error'"
                type="button"
                class="flex w-full min-h-touch items-center justify-center rounded-lg bg-primary py-2 text-center font-medium text-body text-white transition hover:brightness-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                @click="$emit('retry')"
              >
                {{ $t('auth.connectModal.retry') }}
              </button>
              <button
                v-else
                type="button"
                class="flex w-full min-h-touch items-center justify-center rounded-lg bg-cardSecondary py-2 text-center font-medium text-body text-white transition hover:bg-track focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                @click="close"
              >
                {{
                  status === 'connected'
                    ? $t('auth.connectModal.closeNow')
                    : $t('auth.connectModal.cancel')
                }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'
import type { ProviderConnectStatus } from '@/modules/connections/infrastructure/composable/useProviderConnect.ts'
import { providerBrand } from '@/modules/shared/ui/provider-brand.ts'
import { useDialog } from '@/modules/shared/ui/useDialog.ts'

const props = defineProps<{
  open: boolean
  status: ProviderConnectStatus
  errorCode: string
  provider?: string
}>()

const brand = computed(() => providerBrand(props.provider ?? 'strava'))

const emit = defineEmits<{
  close: []
  retry: []
}>()

const AUTO_CLOSE_SECONDS = 5

const dialog = ref<HTMLElement | null>(null)
const openRef = toRef(props, 'open')
const { attrs: dialogAttrs } = useDialog(dialog, {
  active: openRef,
  labelledby: 'strava-dialog-title',
  onEscape: close,
})

const secondsLeft = ref(AUTO_CLOSE_SECONDS)
let countdown: ReturnType<typeof setInterval> | null = null

const { t } = useI18n()

const errorMessage = computed(() => {
  switch (props.errorCode) {
    case 'popup_blocked':
      return useI18nText('auth.connectModal.errors.popupBlocked')
    case 'app_full':
      return useI18nText('auth.connectModal.errors.appFull')
    case 'already_linked':
    case 'strava_already_linked':
      return useI18nText('auth.connectModal.errors.alreadyLinked')
    case 'timeout':
      return useI18nText('auth.connectModal.errors.timeout')
    case 'connect_requires_login':
      return useI18nText('auth.connectModal.errors.loginFirst')
    default:
      return useI18nText('auth.connectModal.errors.generic')
  }
})

const title = computed(() => {
  if (props.status === 'connected') return useI18nText('auth.connectModal.connectedTitle')
  if (props.status === 'error') return useI18nText('auth.connectModal.errorTitle')
  return useI18nText('auth.connectModal.waitingTitle')
})

// `useI18n()` is only valid in setup; route copy through a stable helper.
function useI18nText(key: string): string {
  return t(key)
}

function clearCountdown(): void {
  if (countdown) clearInterval(countdown)
  countdown = null
}

function startCountdown(): void {
  clearCountdown()
  secondsLeft.value = AUTO_CLOSE_SECONDS
  countdown = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) {
      clearCountdown()
      close()
    }
  }, 1000)
}

function close(): void {
  clearCountdown()
  emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      clearCountdown()
      return
    }
    if (props.status === 'connected') startCountdown()
  },
)

watch(
  () => props.status,
  (status) => {
    if (status === 'connected') startCountdown()
    else clearCountdown()
  },
)

onBeforeUnmount(clearCountdown)
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
