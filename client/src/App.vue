<template>
  <!-- Public pages (landing, login) render chromeless — no sidebar/header/nav -->
  <div
    v-if="$route.meta.public"
    class="min-h-screen bg-background text-white"
  >
    <RouterView v-slot="{ Component }">
      <component
        :is="Component"
        :key="$route.path"
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
            :key="$route.path"
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
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ConsentBanner from '@/components/ui/ConsentBanner.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import AppHeader from '@/layouts/AppHeader.vue'
import AppSidebar from '@/layouts/AppSidebar.vue'
import { consumePendingToast } from '@/modules/shared/ui/pendingToast.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { show } = useToast()

/**
 * An OAuth popup that landed on the app itself — the result page could not run
 * because the state cookie was lost on the way back. Tell the opener and close
 * this window instead of leaving a stray app tab open.
 */
function handOffToOpener(): boolean {
  if (!window.opener || !window.name.startsWith('pacepilot-')) return false
  const code = typeof route.query.error === 'string' ? route.query.error : ''
  const status = code ? 'error' : 'connected'
  try {
    window.opener.postMessage(
      { type: 'pacepilot:connection', status, code },
      window.location.origin,
    )
  } catch {
    // A cross-origin opener cannot be messaged, but closing is still correct.
  }
  window.close()
  return true
}

onMounted(() => {
  if (handOffToOpener()) return

  // Same-window OAuth (installed app) returns here with ?connected=1.
  if (route.query.connected === '1') {
    show(t('strava.sync.connected'), { type: ToastType.Success })
    const query = { ...route.query }
    delete query.connected
    void router.replace({ query })
    return
  }

  // An action that ends in a reload (provider disconnect) parks its outcome here
  // first, so the athlete still learns what happened after the app reboots.
  const pending = consumePendingToast()
  if (!pending) return
  show(
    pending.message,
    pending.position ? { type: pending.type, position: pending.position } : { type: pending.type },
  )
})
</script>
