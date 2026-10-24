<template>
  <div class="mx-auto w-full max-w-narrow py-6">
    <div class="flex flex-col gap-5 rounded-card border border-border bg-card p-6 sm:p-8">
      <div class="flex items-center gap-3">
        <span class="flex h-11 w-11 items-center justify-center rounded-full bg-strava/15">
          <StravaIcon cls="h-6 w-6 text-strava" />
        </span>
        <div>
          <p class="font-bold text-label text-primary">{{ $t('auth.connectModal.kicker') }}</p>
          <h1 class="font-extrabold text-3xl text-white leading-display">
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
        v-if="pageError"
        role="alert"
        class="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
      >
        {{ pageError }}
      </p>

      <div class="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          class="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-lg bg-strava px-5 py-4 font-bold text-sm text-white transition hover:brightness-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          @click="openConnect"
        >
          <StravaIcon cls="h-5 w-5" />
          {{ $t('auth.connectButton') }}
        </button>
        <button
          type="button"
          class="min-h-touch rounded-lg border border-border bg-cardSecondary px-5 py-4 font-semibold text-body text-white transition hover:bg-track focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          @click="later"
        >
          {{ $t('auth.connectModal.later') }}
        </button>
      </div>

      <p class="text-caption text-faint">
        {{ $t('auth.connectModal.privacy') }}
      </p>
    </div>

    <StravaConnectDialog
      :open="dialogOpen"
      :status="status"
      :error-code="errorCode"
      @close="onClose"
      @retry="retry"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import CheckIcon from '@/components/icons/CheckIcon.vue'
import StravaIcon from '@/components/icons/StravaIcon.vue'
import StravaConnectDialog from '@/features/auth/components/StravaConnectDialog.vue'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { refreshAfterStravaConnect } from '@/modules/strava/infrastructure/composable/refreshAfterConnect.ts'
import { useStravaConnect } from '@/modules/strava/infrastructure/composable/useStravaConnect.ts'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { ensure, strava, markStravaPromptSeen } = useAuth()
const { status, errorCode, connect, cancel } = useStravaConnect()

const dialogOpen = ref(false)

const nextPath = computed(() => {
  const value = route.query.next
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/workout'
})

const pageError = computed(() => {
  const code = route.query.error
  if (code === 'app_full') return t('auth.connectModal.errors.appFull')
  if (code === 'strava_already_linked') return t('auth.connectModal.errors.alreadyLinked')
  if (code === 'connect_requires_login') return t('auth.error.connectFirst')
  if (code) return t('auth.connectModal.errors.generic')
  return ''
})

function openConnect(): void {
  dialogOpen.value = true
  // Synchronous inside the click so the browser allows the popup.
  connect(nextPath.value)
}

function retry(): void {
  connect(nextPath.value)
}

async function finish(): Promise<void> {
  // Enter the app immediately; the import runs in the background and the
  // refresh key remounts whatever view is visible when it lands.
  void refreshAfterStravaConnect()
  await router.replace(nextPath.value)
}

function onClose(): void {
  dialogOpen.value = false
  const wasConnected = status.value === 'connected'
  cancel()
  if (wasConnected) void finish()
}

async function later(): Promise<void> {
  try {
    await markStravaPromptSeen()
  } catch {
    // Best-effort: the athlete can still connect from Settings.
  }
  await router.replace(nextPath.value)
}

onMounted(async () => {
  if (!(await ensure())) {
    await router.replace({ path: '/login', query: { next: route.fullPath } })
    return
  }
  if (strava.value.connected) {
    await router.replace(nextPath.value)
    return
  }
  // Asked once. The page itself is the prompt; Settings keeps the manual entry.
  void markStravaPromptSeen()
})
</script>
