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
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AthleteAvatar from '@/components/ui/AthleteAvatar.vue'
import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { refreshAfterConnect } from '@/modules/connections/infrastructure/composable/refreshAfterConnect.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { useProviderConnect } from '@/modules/connections/infrastructure/composable/useProviderConnect.ts'
import { clearRunDayCache } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import {
  invalidateResource,
  invalidateResourcePrefix,
  resetResource,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api, apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { show: showToast } = useToast()
const { user: currentUser, fetchUser, clearUser } = useCurrentUser()
const { ensure, emailVerified } = useAuth()
const { fullName } = useUserIdentity()
const { connected: stravaConnected, activeProvider, checkStatus, setConnected } = useConnection()
const { status: connectStatus, connect } = useProviderConnect()
const confirming = ref(false)
const resendingVerification = ref(false)
const verificationSent = ref(false)
const erasing = ref(false)
const disconnecting = ref(false)
const error = ref('')

onMounted(async () => {
  await fetchUser()
  try {
    await checkStatus()
  } catch {
    // The status read is best-effort; the card falls back to "connect".
  }
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

watch(connectStatus, async (next) => {
  if (next !== 'connected') return
  // Re-reads the connection status in place, so the card flips to connected
  // without a second request or a blank frame.
  await refreshAfterConnect()
})

async function disconnectStrava() {
  disconnecting.value = true
  try {
    await api.providers.disconnect(activeProvider.value)
    // One write to the shared connection entry: the notice, the avatar dot and
    // the sync action all move together, and a forced read confirms it.
    // The connection entry is the only source: `setConnected` already writes it
    // and forces the confirming read, so it is not invalidated a second time.
    setConnected(false)
    // The source is gone, so the plan, the progress and every activity page
    // change: refresh them in place rather than blanking the visible screen.
    invalidateResource(RESOURCE_KEYS.planWeek)
    invalidateResource(RESOURCE_KEYS.progress)
    invalidateResourcePrefix('activities:')
    // The session carries its own copy of the link (the connect prompt reads
    // it): re-read it instead of writing a second local answer.
    void ensure(true)
    // The account session survives a disconnect: only the data source is gone.
    showToast(t('settings.strava.disconnected'), { type: ToastType.Success })
  } catch (e) {
    showToast(apiErrorMessage(e, t('strava.sync.failed')), { type: ToastType.Error })
  } finally {
    disconnecting.value = false
  }
}

async function erase() {
  erasing.value = true
  error.value = ''
  try {
    await api.account.delete()
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
