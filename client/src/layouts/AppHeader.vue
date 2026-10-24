<template>
  <header
    class="flex justify-between items-center bg-background px-6 py-4 border-white/10 border-b"
  >
    <div class="flex items-center gap-3">
      <RouterLink
        to="/"
        class="sm:hidden flex items-center gap-2.5 shrink-0"
      >
        <BrandLogo :show-text="false" />
      </RouterLink>
    </div>
    <div class="flex items-center gap-3">
      <LanguageSwitcher />
      <NotificationCenter
        v-if="checked"
        :last-synced-at="lastSyncedAt ?? ''"
      />

      <!-- mobile navigation menu; desktop menu lives at the bottom of the sidebar -->
      <MobileMenu />
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import MobileMenu from '@/layouts/MobileMenu.vue'
import NotificationCenter from '@/layouts/NotificationCenter.vue'
import { useAutoSync } from '@/modules/connections/infrastructure/composable/useAutoSync.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

const { checked, lastSyncedAt, checkStatus } = useConnection()

// Imports on app load when the last sync is stale; both callers share one use case.
useAutoSync()

onMounted(async () => {
  try {
    await checkStatus()
  } catch (error) {
    recordRecoveredError(error)
  }
})
</script>
