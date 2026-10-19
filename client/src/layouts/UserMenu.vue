<template>
  <!-- profile dropdown (Tailwind Plus — Elements / Dropdowns / User menu) -->
  <AppDropdown
    class="w-full"
    :panel-class="panelClass"
  >
    <template #trigger="{ open, toggle }">
      <button
        type="button"
        class="flex items-center gap-2 hover:bg-white/5 p-2 rounded-full min-h-touch w-full text-left transition"
        :aria-label="$t('shell.userMenu')"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="toggle"
      >
        <AthleteAvatar />
        <span class="block min-w-0 flex-1 font-medium text-white text-sm truncate">
          {{ fullName }}
        </span>
        <ChevronDownIcon cls="block w-4 h-4 text-muted shrink-0" />
      </button>
    </template>

    <template #default="{ close }">
      <!-- user header -->
      <div class="px-4 py-3 border-white/10 border-b">
        <div class="font-semibold text-white text-sm truncate">
          {{ fullName }}
        </div>
        <div class="text-muted text-xs truncate">
          {{ currentUser?.email || $t('shell.athlete') }}
        </div>
      </div>

      <!-- primary links -->
      <RouterLink
        to="/"
        class="flex items-center gap-3 hover:bg-white/5 px-4 py-2 text-white text-sm transition"
        role="menuitem"
        @click="close()"
      >
        <HomeIcon cls="w-5 h-5 text-muted" />
        {{ $t('landing.back') }}
      </RouterLink>

      <!-- settings at the bottom (Plus: divided section) -->
      <div class="mt-1 pt-1 border-white/10 border-t">
        <RouterLink
          to="/settings"
          class="flex items-center gap-3 hover:bg-white/5 px-4 py-2 text-white text-sm transition"
          role="menuitem"
          @click="close()"
        >
          <Cog6ToothIcon cls="w-5 h-5 text-muted" />
          {{ $t('shell.settings') }}
        </RouterLink>
      </div>
    </template>
  </AppDropdown>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import ChevronDownIcon from '@/components/icons/ChevronDownIcon.vue'
import Cog6ToothIcon from '@/components/icons/Cog6ToothIcon.vue'
import HomeIcon from '@/components/icons/HomeIcon.vue'
import AppDropdown from '@/components/ui/AppDropdown.vue'
import AthleteAvatar from '@/components/ui/AthleteAvatar.vue'
import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'

defineProps({
  panelClass: { type: String, default: 'right-0 w-56' },
})

const { user: currentUser, fetchUser } = useCurrentUser()
const { fullName } = useUserIdentity()

onMounted(() => {
  fetchUser()
})
</script>
