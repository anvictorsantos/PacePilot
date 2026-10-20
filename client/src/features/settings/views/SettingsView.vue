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
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.strava.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.strava.desc') }}</p>
        <a
          v-if="!stravaConnected"
          href="/api/strava/authorize?next=/workout"
          class="inline-flex justify-center items-center bg-cardSecondary hover:bg-track mt-4 px-4 py-2 border border-white/10 rounded-xl min-h-touch font-semibold text-white text-sm transition"
        >
          {{ $t('settings.strava.connect') }}
        </a>
        <button
          v-else
          :disabled="disconnecting"
          class="bg-white/10 hover:bg-white/15 disabled:opacity-50 mt-4 px-4 py-2 rounded-xl min-h-touch text-white text-sm transition"
          @click="disconnectStrava"
        >
          {{
            disconnecting ? $t('settings.strava.disconnecting') : $t('settings.strava.disconnect')
          }}
        </button>
        <p
          v-if="stravaError"
          class="mt-3 text-danger text-sm"
        >
          {{ stravaError }}
        </p>
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
        class="bg-card p-6 border border-danger/30 rounded-2xl"
      >
        <div class="font-semibold text-white text-sm">{{ $t('settings.delete.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.delete.desc') }}</p>
        <button
          v-if="!confirming"
          class="bg-transparent hover:bg-danger/10 mt-4 px-4 py-2 border border-danger/50 rounded-xl min-h-touch font-semibold text-danger text-sm transition"
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
            class="bg-danger disabled:opacity-50 hover:brightness-110 px-4 py-2 rounded-xl min-h-touch font-semibold text-white text-sm transition"
            @click="erase"
          >
            {{ erasing ? $t('settings.delete.erasing') : $t('settings.delete.confirm') }}
          </button>
          <button
            :disabled="erasing"
            class="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-xl min-h-touch text-white text-sm transition"
            @click="confirming = false"
          >
            {{ $t('settings.delete.keep') }}
          </button>
        </div>
        <p
          v-if="error"
          class="mt-3 text-danger text-sm"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AthleteAvatar from '@/components/ui/AthleteAvatar.vue'
import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { clearRunDayCache } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { api, apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'
import { useSession } from '@/modules/strava/infrastructure/composable/useSession.ts'

const router = useRouter()
const { t } = useI18n()
const { show: showToast } = useToast()
const { user: currentUser, fetchUser, clearUser } = useCurrentUser()
const { fullName } = useUserIdentity()
const { connected: stravaConnected, checkStatus, setConnected } = useSession()
const confirming = ref(false)
const erasing = ref(false)
const disconnecting = ref(false)
const error = ref('')
const stravaError = ref('')

onMounted(async () => {
  fetchUser()
  try {
    await checkStatus()
  } catch {
    // The status read is best-effort; the card falls back to "connect".
  }
})

async function disconnectStrava() {
  disconnecting.value = true
  stravaError.value = ''
  try {
    await api.strava.disconnect()
    setConnected(false)
    clearUser()
    router.replace('/login')
  } catch (e) {
    stravaError.value = apiErrorMessage(e, t('strava.sync.failed'))
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
    showToast(t('settings.delete.erased'), { type: ToastType.Success })
    router.replace('/login')
  } catch (e) {
    error.value = apiErrorMessage(e, t('settings.delete.eraseFail'))
  } finally {
    erasing.value = false
  }
}
</script>
