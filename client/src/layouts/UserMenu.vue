<template>
  <div class="flex items-center gap-2.5 w-full">
    <AthleteAvatar />
    <div class="flex flex-col flex-1 items-start gap-[3px] min-w-0">
      <span class="font-semibold text-white text-xs leading-tight truncate w-full">
        {{ fullName }}
      </span>
      <span class="font-normal text-muted text-caption leading-caption truncate w-full">
        {{ $t('strava.status.connected') }}
      </span>
    </div>
    <button
      type="button"
      :aria-label="$t('shell.logout')"
      :title="$t('shell.logout')"
      :disabled="loggingOut"
      class="flex justify-center items-center hover:bg-white/5 disabled:opacity-50 rounded-lg min-w-touch min-h-touch text-muted hover:text-white shrink-0 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      @click="logout"
    >
      <LogoutIcon cls="w-4 h-4" />
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

const { fetchUser } = useCurrentUser()
const { fullName } = useUserIdentity()
const { loggingOut, logout } = useLogout()

onMounted(() => {
  fetchUser()
})
</script>
