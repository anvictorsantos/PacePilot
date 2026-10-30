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
      class="flex justify-center items-center bg-track rounded-full w-8 h-8 font-bold text-white text-label leading-label"
    >
      {{ initials }}
    </div>
    <!-- Provider state, once it is known: green when a source is linked, red
         when the account has none (nothing can be imported until it is). -->
    <span
      v-if="checked"
      class="-top-0.5 -right-0.5 absolute flex w-2.5 h-2.5"
    >
      <span
        class="inline-flex absolute opacity-75 rounded-full w-full h-full animate-ping"
        :class="stravaConnected ? 'bg-success' : 'bg-danger'"
      ></span>
      <span
        class="inline-flex relative rounded-full ring-2 ring-background w-2.5 h-2.5"
        :class="stravaConnected ? 'bg-success' : 'bg-danger'"
      ></span>
    </span>
    <span
      v-if="checked"
      class="sr-only"
    >
      {{
        stravaConnected ? $t('connection.status.connected') : $t('connection.status.notConnected')
      }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'

const photoFailed = ref(false)
const { user: currentUser } = useCurrentUser()
const { fullName, initials } = useUserIdentity()
const { connected: stravaConnected, checked } = useConnection()

// Retry avatar when profile URL changes (e.g. re-login with fresh photo).
watch(
  () => currentUser.value?.profile,
  () => {
    photoFailed.value = false
  },
)
</script>
