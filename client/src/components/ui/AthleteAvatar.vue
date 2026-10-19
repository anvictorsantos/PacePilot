<template>
  <div class="relative shrink-0">
    <img
      v-if="currentUser?.profile && !photoFailed"
      :src="currentUser.profile"
      :alt="fullName"
      class="border border-white/10 rounded-full w-8 h-8 object-cover"
      referrerpolicy="no-referrer"
      @error="photoFailed = true"
    />
    <div
      v-else
      class="flex justify-center items-center bg-primary rounded-full w-8 h-8 font-bold text-white text-sm"
    >
      {{ initials }}
    </div>
    <span
      v-if="stravaConnected"
      class="-top-0.5 -right-0.5 absolute flex w-2.5 h-2.5"
    >
      <span
        class="inline-flex absolute bg-success opacity-75 rounded-full w-full h-full animate-ping"
      ></span>
      <span
        class="inline-flex relative bg-success rounded-full ring-2 ring-background w-2.5 h-2.5"
      ></span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { useSession } from '@/modules/strava/infrastructure/composable/useSession.ts'

const photoFailed = ref(false)
const { user: currentUser } = useCurrentUser()
const { fullName, initials } = useUserIdentity()
const { connected: stravaConnected } = useSession()

// Retry avatar when profile URL changes (e.g. re-login with fresh photo).
watch(
  () => currentUser.value?.profile,
  () => {
    photoFailed.value = false
  },
)
</script>
