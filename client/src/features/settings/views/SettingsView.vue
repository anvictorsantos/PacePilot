<template>
  <div class="flex flex-col gap-5">
    <div class="flex justify-between items-start gap-6">
      <div>
        <p class="mb-1.5 font-mono text-label text-faint">
          {{ (currentUser?.email || $t('settings.profile.desc')) + ' · ' + timezone }}
        </p>
        <h1 class="font-medium text-page text-primary tracking-tight leading-none">
          {{ $t('settings.title') }}
        </h1>
      </div>
      <div
        v-if="currentUser"
        class="font-mono text-label text-muted text-right leading-relaxed"
      >
        {{ activeProvider || $t('settings.strava.title') }}<br />
        {{ emailVerified ? $t('settings.email.verified') : $t('settings.email.unverified') }}
      </div>
    </div>

    <div class="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
      <div class="flex flex-col gap-5 min-w-0">
        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-sm text-primary">{{ $t('ui.profile_title') }}</h3>
          <p class="mt-1 mb-4.5 text-body text-faint max-w-[56ch]">{{ $t('settings.profile.desc') }}</p>
          <div class="flex items-center gap-3">
            <AthleteAvatar />
            <div class="min-w-0">
              <div class="font-medium text-primary text-body truncate">{{ fullName }}</div>
              <div class="text-muted text-body truncate">
                {{ currentUser?.email || $t('settings.profile.desc') }}
              </div>
            </div>
          </div>
          <div class="mt-3 text-muted text-label">{{ $t('settings.timezone') }}: {{ timezone }}</div>
          <div class="flex flex-wrap items-center gap-2 mt-2 text-label">
            <span :class="emailVerified ? 'text-success' : 'text-warning'">
              {{ emailVerified ? $t('settings.email.verified') : $t('settings.email.unverified') }}
            </span>
            <button
              v-if="!emailVerified"
              type="button"
              class="disabled:opacity-60 text-primary hover:underline transition cursor-pointer disabled:cursor-not-allowed"
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

        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-sm text-primary">{{ $t('settings.strava.title') }}</h3>
          <p class="mt-1 mb-4.5 text-body text-faint">{{ $t('settings.strava.desc') }}</p>
          <div class="flex items-center justify-between gap-5 py-3 border-b border-white/10">
            <div>
              <div class="text-body text-primary">{{ $t('settings.strava.title') }}</div>
              <div class="text-label text-faint mt-0.5">
                <span
                  class="inline-block bg-accent rounded-full w-1.5 h-1.5 mr-1.5 align-[1px]"
                  aria-hidden="true"
                ></span>
                {{
                  stravaConnected
                    ? $t('connection.status.connected')
                    : $t('connection.status.notConnected')
                }}
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                v-if="!stravaConnected"
                type="button"
                class="border border-white/20 hover:text-primary rounded-lg px-3.5 py-2 text-body text-muted transition cursor-pointer"
                @click="openConnect"
              >
                {{ $t('settings.strava.connect') }}
              </button>
              <button
                v-else
                :disabled="disconnecting"
                class="border border-white/20 hover:text-primary disabled:opacity-50 rounded-lg px-3.5 py-2 text-body text-muted transition cursor-pointer disabled:cursor-not-allowed"
                @click="disconnectStrava"
              >
                {{
                  disconnecting
                    ? $t('settings.strava.disconnecting')
                    : $t('settings.strava.disconnect')
                }}
              </button>
            </div>
          </div>
          <div
            v-if="stravaConnected"
            class="mt-4 pt-4 border-white/10 border-t"
          >
            <div class="font-medium text-body text-primary">
              {{ $t('settings.strava.backfill.title') }}
            </div>
            <p class="mt-1 text-body text-faint">{{ $t('settings.strava.backfill.desc') }}</p>
            <!-- Stays mounted so a text swap is announced; a region inserted with its text is not. -->
            <p
              class="mt-2 min-h-5 text-body text-muted"
              aria-live="polite"
            >
              {{ backfillLine }}
            </p>
            <button
              v-if="backfillBusy"
              type="button"
              class="mt-3 px-4 py-2 rounded-lg min-h-touch text-body text-muted border border-white/20 transition cursor-pointer"
              @click="stopBackfill"
            >
              {{ $t('settings.strava.backfill.stop') }}
            </button>
            <button
              v-else
              type="button"
              class="mt-3 px-4 py-2 rounded-lg min-h-touch text-body text-muted border border-white/20 transition cursor-pointer"
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

        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-sm text-primary">{{ $t('settings.data.title') }}</h3>
          <p class="mt-1.5 text-body text-muted max-w-[56ch]">{{ $t('settings.data.desc') }}</p>
          <p class="mt-2 text-body text-faint">{{ $t('settings.gdpr') }}</p>
        </div>

        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-sm text-primary">{{ $t('settings.about.title') }}</h3>
          <p class="mt-1.5 text-body text-muted">{{ $t('settings.about.desc') }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-4 min-w-0">
        <div
          v-if="currentUser"
          class="bg-card p-4.5 border border-white/10 rounded-xl"
        >
          <h4 class="mb-2 font-medium text-body text-primary">{{ $t('settings.title') }}</h4>
          <div class="flex justify-between items-baseline gap-4 py-2 border-b border-white/10 text-body">
            <span class="text-faint">{{ $t('shell.athlete') }}</span>
            <span class="font-mono text-label text-primary text-right">{{ fullName }}</span>
          </div>
          <div class="flex justify-between items-baseline gap-4 py-2 border-b border-white/10 text-body">
            <span class="text-faint">{{ $t('settings.timezone') }}</span>
            <span class="font-mono text-label text-primary text-right">{{ timezone }}</span>
          </div>
          <div class="flex justify-between items-baseline gap-4 py-2 text-body">
            <span class="text-faint">{{ $t('settings.strava.title') }}</span>
            <span class="font-mono text-label text-primary text-right">{{
              stravaConnected ? $t('connection.status.connected') : $t('connection.status.notConnected')
            }}</span>
          </div>
        </div>

        <div class="bg-card p-4.5 border border-white/10 rounded-xl">
          <h4 class="mb-3 font-medium text-body text-primary">{{ $t('shell.menu') }}</h4>
          <button
            type="button"
            class="w-full justify-center border border-white/20 hover:text-primary rounded-lg px-4 py-2 text-body text-muted transition cursor-pointer"
            @click="logout"
          >
            {{ $t('shell.logout') }}
          </button>
        </div>

        <div
          v-if="currentUser"
          id="delete-account"
          class="bg-card p-4.5 border border-white/10 rounded-xl scroll-mt-6"
        >
          <h4 class="mb-2 font-medium text-body text-primary">{{ $t('settings.delete.title') }}</h4>
          <p class="mb-3 text-label text-faint leading-normal">{{ $t('settings.delete.desc') }}</p>
          <button
            v-if="!confirming"
            class="w-full border border-danger/45 rounded-lg px-4 py-2 text-body text-danger transition cursor-pointer"
            @click="confirming = true"
          >
            {{ $t('settings.delete.button') }}
          </button>
          <div
            v-else
            class="flex flex-col gap-2"
          >
            <button
              :disabled="erasing"
              class="bg-danger disabled:opacity-50 hover:brightness-110 rounded-lg px-4 py-2 text-body text-background transition cursor-pointer disabled:cursor-not-allowed"
              @click="erase"
            >
              {{ erasing ? $t('settings.delete.erasing') : $t('settings.delete.confirm') }}
            </button>
            <button
              :disabled="erasing"
              class="border border-white/20 rounded-lg px-4 py-2 text-body text-muted transition cursor-pointer disabled:cursor-not-allowed"
              @click="confirming = false"
            >
              {{ $t('settings.delete.keep') }}
            </button>
          </div>
          <p
            v-if="error"
            class="mt-3 text-dangerBright text-label"
          >
            {{ error }}
          </p>
        </div>
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
import { useLogout } from '@/modules/account/infrastructure/composable/useLogout.ts'
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
const { fetchUser, clearUser } = useCurrentUser()
const { logout } = useLogout()
const { user: sessionUser, emailVerified } = useAuth()
const { currentUser, fullName } = useUserIdentity()
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
// The browser's own zone; the server keeps planning in its zone for now.
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '—'
const confirming = ref(false)
const resendingVerification = ref(false)
const verificationSent = ref(false)
const erasing = ref(false)
const disconnecting = ref(false)
const error = ref('')

/**
 * One line of state, not a progress bar: the walk has no total to divide by — the
 * cursor moves until the server's retention floor.
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
  // Same handoff as disconnect: park the outcome, reload, and let App.vue announce it.
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
  // Park the outcome, then reload: every view must re-read the account with no
  // provider attached, and an in-memory toast would not survive it.
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
    // Hard clear: the reads on screen belong to an account that no longer exists,
    // and nothing may survive for the next one on this browser.
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
