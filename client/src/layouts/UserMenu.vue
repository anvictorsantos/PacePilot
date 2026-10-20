<template>
  <div class="flex items-center gap-2.5 w-full">
    <AthleteAvatar />
    <div class="flex flex-col flex-1 items-start gap-[3px] min-w-0">
      <span class="w-full font-semibold text-white text-xs truncate leading-tight">
        {{ fullName }}
      </span>
      <span class="w-full font-normal text-caption text-muted truncate leading-caption">
        {{ $t('strava.status.connected') }}
      </span>
    </div>
    <button
      type="button"
      :aria-label="$t('shell.logout')"
      :title="$t('shell.logout')"
      :disabled="loggingOut"
      class="flex justify-center items-center disabled:opacity-50 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-w-touch min-h-touch text-muted hover:text-white transition cursor-pointer shrink-0"
      @click="logout"
    >
      <LogoutIcon cls="w-6 h-6" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import LogoutIcon from '@/components/icons/LogoutIcon.vue'
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
const { fetchUser, clearUser } = useCurrentUser()
const { fullName } = useUserIdentity()
const { setConnected } = useSession()

const loggingOut = ref(false)

onMounted(() => {
  fetchUser()
})

/** Server clears the httpOnly cookie; the client drops every cached view. */
async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await api.strava.disconnect()
    setConnected(false)
    clearUser()
    clearRunDayCache()
    await router.replace('/login')
  } catch (error) {
    showToast(apiErrorMessage(error, t('shell.logoutFailed')), { type: ToastType.Error })
  } finally {
    loggingOut.value = false
  }
}
</script>
