<template>
  <!-- Public pages (landing, login) render chromeless — no sidebar/header/nav -->
  <div
    v-if="$route.meta.public"
    class="min-h-screen bg-background text-white"
  >
    <RouterView v-slot="{ Component }">
      <component
        :is="Component"
        :key="`${$route.path}:${refreshKey}`"
      />
    </RouterView>
  </div>
  <div
    v-else
    class="min-h-screen bg-background text-white flex"
  >
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />
      <main class="flex-1 p-4 md:p-6 overflow-auto">
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :key="`${$route.path}:${refreshKey}`"
          />
        </RouterView>
      </main>
    </div>
    <ToastContainer />
  </div>
  <ToastContainer v-if="$route.meta.public" />
  <!-- Analytics consent is asked on every layout, public or gated. -->
  <ConsentBanner />
</template>

<script setup lang="ts">
import ConsentBanner from '@/components/ui/ConsentBanner.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import AppHeader from '@/layouts/AppHeader.vue'
import AppSidebar from '@/layouts/AppSidebar.vue'
import { appRefreshVersion } from '@/modules/shared/infrastructure/app-refresh.ts'

const refreshKey = appRefreshVersion()
</script>
