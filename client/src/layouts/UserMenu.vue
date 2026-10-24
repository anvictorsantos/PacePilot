<template>
  <div class="flex items-center gap-2.5 w-full">
    <AthleteAvatar />
    <div class="flex flex-col flex-1 items-start gap-[3px] min-w-0">
      <span class="w-full font-semibold text-white text-xs truncate leading-tight">
        {{ fullName }}
      </span>
      <span class="w-full font-normal text-caption text-muted truncate leading-caption">
        {{ stravaConnected ? $t('strava.status.connected') : $t('strava.status.notConnected') }}
      </span>
    </div>
    <button
      type="button"
      :aria-label="$t('shell.logout')"
      :title="$t('shell.logout')"
      :disabled="loggingOut"
      class="flex justify-center items-center hover:bg-white/5 disabled:opacity-50 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-w-touch min-h-touch text-muted hover:text-white transition shrink-0"
      @click="logout"
    >
      <LogoutIcon cls="w-6 h-6" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import LogoutIcon from '@/components/icons/LogoutIcon.vue'
import AthleteAvatar from '@/components/ui/AthleteAvatar.vue'
import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useLogout } from '@/modules/account/infrastructure/composable/useLogout.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { useSession } from '@/modules/strava/infrastructure/composable/useSession.ts'

const { fetchUser } = useCurrentUser()
const { fullName } = useUserIdentity()
const { loggingOut, logout } = useLogout()
const { connected: stravaConnected } = useSession()

onMounted(() => {
  fetchUser()
})
</script>
