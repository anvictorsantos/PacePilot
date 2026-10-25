<template>
  <div class="max-w-2xl">
    <div class="flex justify-between items-center gap-4">
      <h1 class="font-bold text-white text-2xl">{{ $t('settings.title') }}</h1>
    </div>
    <div class="space-y-4 mt-6">
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="flex items-center gap-3">
          <AthleteAvatar />
          <div class="min-w-0">
            <div class="font-semibold text-white text-sm truncate">{{ fullName }}</div>
            <div class="text-muted text-sm truncate">
              {{ currentUser?.email || $t('settings.profile.desc') }}
            </div>
          </div>
        </div>
        <div class="mt-2 text-muted text-xs">{{ $t('settings.timezone') }}: Europe/Lisbon</div>
        <div class="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span :class="emailVerified ? 'text-success' : 'text-warning'">
            {{ emailVerified ? $t('settings.email.verified') : $t('settings.email.unverified') }}
          </span>
          <button
            v-if="!emailVerified"
            type="button"
            class="disabled:opacity-60 font-semibold text-primaryBright hover:text-primaryBright underline transition cursor-pointer disabled:cursor-not-allowed"
            :disabled="resendingVerification"
            @click="resendVerification"
          >
            {{
              resendingVerification ? $t('settings.email.resending') : $t('settings.email.resend')
            }}
          </button>
          <span
            v-if="verificationSent"
            class="text-success"
            role="status"
          >
            {{ $t('settings.email.resent') }}
          </span>
        </div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.strava.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.strava.desc') }}</p>
        <button
          v-if="!stravaConnected"
          type="button"
          class="inline-flex justify-center items-center bg-cardSecondary hover:bg-track mt-4 px-4 py-2 border border-white/10 rounded-xl min-h-touch font-semibold text-white text-sm transition cursor-pointer"
          @click="openConnect"
        >
          {{ $t('settings.strava.connect') }}
        </button>
        <button
          v-else
          :disabled="disconnecting"
          class="bg-white/10 hover:bg-white/15 disabled:opacity-50 mt-4 px-4 py-2 rounded-xl min-h-touch text-white text-sm transition cursor-pointer disabled:cursor-not-allowed"
          @click="disconnectStrava"
        >
          {{
            disconnecting ? $t('settings.strava.disconnecting') : $t('settings.strava.disconnect')
          }}
        </button>
        <div
          v-if="stravaConnected"
          class="mt-4 pt-4 border-white/10 border-t"
        >
          <div class="font-semibold text-white text-sm">
            {{ $t('settings.strava.backfill.title') }}
          </div>
          <p class="mt-1 text-muted text-sm">{{ $t('settings.strava.backfill.desc') }}</p>
          <!-- The region stays mounted so a text swap is announced; a region
               inserted with its text is not, in every screen reader. -->
          <p
            class="mt-2 min-h-5 text-ink text-sm"
            aria-live="polite"
          >
            {{ backfillLine }}
          </p>
          <button
            v-if="backfillBusy"
            type="button"
            class="bg-white/10 hover:bg-white/15 mt-3 px-4 py-2 rounded-xl min-h-touch text-white text-sm transition cursor-pointer"
            @click="stopBackfill"
          >
            {{ $t('settings.strava.backfill.stop') }}
          </button>
          <button
            v-else
            type="button"
            class="bg-cardSecondary hover:bg-track mt-3 px-4 py-2 border border-white/10 rounded-xl min-h-touch font-semibold text-white text-sm transition cursor-pointer"
            @click="startBackfill"
          >
            {{
              backfillStarted
                ? $t('settings.strava.backfill.resume')
                : $t('settings.strava.backfill.start')
            }}
          </button>
        </div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.data.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.data.desc') }}</p>
        <p class="mt-2 text-muted text-sm">{{ $t('settings.gdpr') }}</p>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.about.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.about.desc') }}</p>
      </div>
      <div
        v-if="currentUser"
        id="delete-account"
        class="bg-card p-6 border border-danger/30 rounded-2xl scroll-mt-6"
      >
        <div class="font-semibold text-white text-sm">{{ $t('settings.delete.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.delete.desc') }}</p>
        <button
          v-if="!confirming"
          class="bg-transparent hover:bg-danger/10 mt-4 px-4 py-2 border border-danger/50 rounded-xl min-h-touch font-semibold text-dangerBright text-sm transition cursor-pointer"
          @click="confirming = true"
        >
          {{ $t('settings.delete.button') }}
        </button>
        <div
          v-else
          class="flex flex-wrap items-center gap-3 mt-4"
        >
          <button
            :disabled="erasing"
            class="bg-danger disabled:opacity-50 hover:brightness-110 px-4 py-2 rounded-xl min-h-touch font-semibold text-white text-sm transition cursor-pointer disabled:cursor-not-allowed"
            @click="erase"
          >
            {{ erasing ? $t('settings.delete.erasing') : $t('settings.delete.confirm') }}
          </button>
          <button
            :disabled="erasing"
            class="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-xl min-h-touch text-white text-sm transition cursor-pointer disabled:cursor-not-allowed"
            @click="confirming = false"
          >
            {{ $t('settings.delete.keep') }}
          </button>
        </div>
        <p
          v-if="error"
          class="mt-3 text-dangerBright text-sm"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AthleteAvatar from '@/components/ui/AthleteAvatar.vue'
import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { forgetActivityReadWatermark } from '@/modules/activities/infrastructure/composable/useActivityFeed.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { useBackfill } from '@/modules/connections/infrastructure/composable/useBackfill.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { useProviderConnect } from '@/modules/connections/infrastructure/composable/useProviderConnect.ts'
import { clearRunDayCache } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api, apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { queuePendingToast, type PendingToast } from '@/modules/shared/ui/pendingToast.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { show: showToast } = useToast()
const { user: currentUser, fetchUser, clearUser } = useCurrentUser()
const { user: sessionUser, emailVerified } = useAuth()
const { fullName } = useUserIdentity()
const { connected: stravaConnected, activeProvider, checkStatus } = useConnection()
const { status: connectStatus, connect } = useProviderConnect()
const {
  imported: backfillImported,
  busy: backfillBusy,
  complete: backfillComplete,
  started: backfillStarted,
  failure: backfillFailure,
  refresh: refreshBackfill,
  resume: startBackfill,
  stop: stopBackfill,
} = useBackfill()
const confirming = ref(false)
const resendingVerification = ref(false)
const verificationSent = ref(false)
const erasing = ref(false)
const disconnecting = ref(false)
const error = ref('')

/**
 * One line of state, not a progress bar: the walk has no total to divide by —
 * the cursor moves until the retention floor, and the server decides when that is.
 */
const backfillLine = computed(() => {
  if (backfillFailure.value) {
    return apiErrorMessage(backfillFailure.value, t('settings.strava.backfill.failed'))
  }
  if (backfillBusy.value) {
    return t('settings.strava.backfill.working', { count: backfillImported.value })
  }
  if (backfillComplete.value) return t('settings.strava.backfill.done')
  if (backfillImported.value > 0) {
    return t('settings.strava.backfill.imported', { count: backfillImported.value })
  }
  return backfillStarted.value ? t('settings.strava.backfill.paused') : ''
})

onMounted(async () => {
  await fetchUser()
  try {
    await checkStatus()
  } catch {
    // The status read is best-effort; the card falls back to "connect".
  }
  void refreshBackfill()
  if (route.query.delete === '1') await openDeleteFromMenu()
})

watch(
  () => route.query.delete,
  async (value) => {
    if (value === '1') await openDeleteFromMenu()
  },
)

/** Mobile menu shortcut: open the destructive step and bring it into view. */
async function openDeleteFromMenu(): Promise<void> {
  confirming.value = true
  await nextTick()
  document.getElementById('delete-account')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  void router.replace({ path: '/settings' })
}

function openConnect(): void {
  connect('/settings')
}

async function resendVerification(): Promise<void> {
  if (resendingVerification.value) return
  resendingVerification.value = true
  verificationSent.value = false
  try {
    await api.auth.resendVerification()
    verificationSent.value = true
  } catch (e) {
    showToast(apiErrorMessage(e, t('settings.email.sendFailed')), { type: ToastType.Error })
  } finally {
    resendingVerification.value = false
  }
}

watch(connectStatus, (next) => {
  if (next !== 'connected') return
  // Same handoff as disconnect: park the outcome, reload, and let App.vue
  // announce it after the app has re-read the freshly linked account.
  queuePendingToast({ type: ToastType.Success, message: t('strava.sync.connected') })
  window.location.reload()
})

async function disconnectStrava() {
  if (disconnecting.value) return
  disconnecting.value = true
  let outcome: PendingToast
  try {
    await api.providers.disconnect(activeProvider.value)
    // The account session survives a disconnect: only the data source is gone.
    outcome = { type: ToastType.Success, message: t('settings.strava.disconnected') }
  } catch (e) {
    outcome = {
      type: ToastType.Error,
      message: apiErrorMessage(e, t('settings.strava.disconnectFailed')),
    }
  }
  disconnecting.value = false
  // Park the outcome, then reload: every view has to re-read the account with no
  // provider attached, and an in-memory toast would not survive that. App.vue
  // consumes it on boot and shows it in the ToastContainer.
  queuePendingToast(outcome)
  window.location.reload()
}

async function erase() {
  erasing.value = true
  error.value = ''
  try {
    await api.account.delete()
    forgetActivityReadWatermark(sessionUser.value?.id)
    clearUser()
    clearRunDayCache()
    // Erasure is a hard clear: the reads on screen belong to an account that no
    // longer exists, and nothing may survive for the next one on this browser.
    resetResource()
    showToast(t('settings.delete.erased'), { type: ToastType.Success })
    router.replace('/login')
  } catch (e) {
    error.value = apiErrorMessage(e, t('settings.delete.eraseFail'))
  } finally {
    erasing.value = false
  }
}
</script>
