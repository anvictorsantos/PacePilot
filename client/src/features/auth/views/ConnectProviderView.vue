<template>
  <div class="mx-auto py-6 w-full max-w-narrow">
    <div class="flex flex-col gap-5 bg-card p-6 sm:p-8 border border-border rounded-card">
      <div class="flex items-center gap-3">
        <span
          class="flex justify-center items-center rounded-full w-11 h-11"
          :class="primaryBrand.iconTileClass"
        >
          <component
            :is="primaryBrand.icon"
            cls="h-6 w-6"
          />
        </span>
        <div>
          <p class="font-bold text-label text-primaryBright">
            {{ $t('auth.connectModal.kicker') }}
          </p>
          <h1 class="font-extrabold text-white text-3xl leading-display">
            {{ $t('auth.connectModal.pageTitle') }}
          </h1>
        </div>
      </div>

      <p class="text-body text-muted leading-body">
        {{ $t('auth.connectModal.pageDesc') }}
      </p>

      <ul class="flex flex-col gap-2 text-body text-ink">
        <li class="flex gap-2">
          <CheckIcon cls="mt-0.5 h-4 w-4 shrink-0 text-success" />
          {{ $t('auth.connectModal.benefit1') }}
        </li>
        <li class="flex gap-2">
          <CheckIcon cls="mt-0.5 h-4 w-4 shrink-0 text-success" />
          {{ $t('auth.connectModal.benefit2') }}
        </li>
        <li class="flex gap-2">
          <CheckIcon cls="mt-0.5 h-4 w-4 shrink-0 text-success" />
          {{ $t('auth.connectModal.benefit3') }}
        </li>
      </ul>

      <p
        v-if="refreshing"
        class="text-label text-muted"
        role="status"
        aria-live="polite"
      >
        {{ $t('auth.connectModal.importing') }}
      </p>

      <div class="flex sm:flex-row flex-col gap-3">
        <button
          v-for="provider in providers?.providers ?? []"
          :key="provider.id"
          type="button"
          class="flex flex-1 justify-center items-center gap-2 px-5 py-4 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 min-h-touch font-bold text-white text-sm transition cursor-pointer disabled:cursor-not-allowed"
          :class="providerBrand(provider.id).buttonClass"
          :disabled="refreshing"
          @click="openConnect(provider.id)"
        >
          <component
            :is="providerBrand(provider.id).icon"
            cls="h-5 w-5"
            :class="providerBrand(provider.id).iconClass"
          />
          {{ $t('auth.connectWith', { provider: $t(provider.labelKey) }) }}
        </button>
        <button
          type="button"
          class="bg-cardSecondary hover:bg-track px-5 py-4 border border-border rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-semibold text-body text-white transition cursor-pointer"
          @click="later"
        >
          {{ $t('auth.connectModal.later') }}
        </button>
      </div>

      <p class="text-caption text-faint">
        {{ $t('auth.connectModal.privacy') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import CheckIcon from '@/components/icons/CheckIcon.vue'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { useProviderConnect } from '@/modules/connections/infrastructure/composable/useProviderConnect.ts'
import { useProviders } from '@/modules/connections/infrastructure/composable/useProviders.ts'
import { providerConnectErrorMessage } from '@/modules/connections/infrastructure/notification/providerConnectError.ts'
import { queuePendingToast } from '@/modules/shared/ui/pendingToast.ts'
import { providerBrand } from '@/modules/shared/ui/provider-brand.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { ensure, markStravaPromptSeen } = useAuth()
const { checkStatus } = useConnection()
const { status, connect } = useProviderConnect()
const { show: showToast } = useToast()
const { providers } = useProviders()
const primaryBrand = computed(() => providerBrand(providers.value?.providers[0]?.id ?? 'strava'))
const activeProvider = ref('strava')
const refreshing = ref(false)

let finishing = false
let leaving = false

const nextPath = computed(() => {
  const value = route.query.next
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/workout'
})

function openConnect(provider: string): void {
  activeProvider.value = provider
  // Synchronous inside the click so the browser allows the popup.
  connect(nextPath.value, provider)
}

async function finish(): Promise<void> {
  if (finishing) return
  finishing = true
  // Full document load into the app: the import starts on boot, every view
  // reads the linked account from scratch, and the success toast parks in
  // sessionStorage so App.vue can announce it after the reload.
  queuePendingToast({ type: ToastType.Success, message: t('strava.sync.connected') })
  window.location.assign(nextPath.value)
}

watch(status, (next) => {
  if (next === 'connected') void finish()
})

async function later(): Promise<void> {
  if (leaving) return
  // Leaving is always possible, import or not: "Later" is the exit a stalled
  // server must never take away.
  leaving = true
  try {
    await markStravaPromptSeen()
  } catch {
    // Best-effort: the athlete can still connect from Settings.
  }
  await router.replace(nextPath.value)
}

onMounted(async () => {
  const error = route.query.error
  if (typeof error === 'string' && error) {
    showToast(providerConnectErrorMessage(error), { type: ToastType.Error, duration: 6000 })
    const query = { ...route.query }
    delete query.error
    await router.replace({ query })
  }
  if (!(await ensure())) {
    await router.replace({ path: '/login', query: { next: route.fullPath } })
    return
  }
  if (await checkStatus()) {
    await router.replace(nextPath.value)
    return
  }
  // Asked once. The page itself is the prompt; Settings keeps the manual entry.
  void markStravaPromptSeen()
})
</script>
