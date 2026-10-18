<template>
  <div class="max-w-xl mx-auto text-center py-10">
    <LightningLoader v-if="loading" />
    <template v-else-if="connected">
      <div class="bg-card border border-white/10 rounded-2xl p-8">
        <CheckCircleIcon cls="w-10 h-10 text-success mx-auto mb-2" />
        <h1 class="text-white text-xl font-bold">{{ $t('strava.status.connected') }}</h1>
        <p class="text-muted text-sm mt-2">
          <template v-if="lastSyncedAt"
            >{{ $t('strava.sync.lastSync') }}: {{ relativeTime(lastSyncedAt) }}.</template
          >
          <template v-else>{{ $t('strava.sync.never') }}</template>
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <button
            :disabled="syncing"
            class="bg-primary hover:bg-primaryBright disabled:opacity-50 text-white font-semibold px-6 py-2.5 min-h-touch rounded-xl transition"
            @click="sync"
          >
            {{ syncing ? $t('strava.sync.buttonInProgress') : $t('strava.sync.button') }}
          </button>
          <button
            class="bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 min-h-touch rounded-xl transition"
            @click="disconnect"
          >
            {{ $t('strava.sync.disconnect') }}
          </button>
        </div>
      </div>
    </template>
    <template v-else>
      <h1 class="text-white text-2xl font-bold">{{ $t('strava.connect.title') }}</h1>
      <p class="text-muted text-sm mt-2">{{ $t('strava.connect.desc') }}</p>
      <div class="mt-6 bg-card border border-white/10 rounded-2xl p-6 text-left space-y-2">
        <div class="text-white text-sm font-semibold mb-2">
          {{ $t('strava.connect.featuresTitle') }}
        </div>
        <div
          v-for="item in features"
          :key="item"
          class="text-muted text-sm flex gap-2 items-center"
        >
          <CheckIcon cls="w-4 h-4 shrink-0 text-success" /> {{ item }}
        </div>
      </div>
      <div class="mt-6">
        <button
          class="inline-flex items-center gap-2 bg-strava hover:bg-stravaDark text-white font-semibold px-8 py-3 min-h-touch rounded-xl transition"
          @click="connect"
        >
          <LinkIcon cls="w-5 h-5" /> {{ $t('landing.sections.connect.step1.title') }}
        </button>
      </div>
      <p
        v-if="error"
        class="text-danger text-sm mt-4"
      >
        {{ error }}
      </p>
    </template>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import CheckIcon from '@/components/icons/CheckIcon.vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import LightningLoader from '@/components/ui/LightningLoader.vue'
import { useCurrentUser } from '@/composables/useCurrentUser.ts'
import { useSession } from '@/composables/useSession.ts'
import { useToast } from '@/composables/useToast.ts'
import { api, apiErrorMessage } from '@/services/client.ts'
import { recordRecoveredError } from '@/services/logger.ts'

const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const { show: showToast } = useToast()
const { setConnected } = useSession()
const { clearUser } = useCurrentUser()
const connected = ref(false)
const loading = ref(true)
const syncing = ref(false)
const lastSyncedAt = ref<string | null>(null)
const error = ref(route.query.error || '')
const features = computed<string[]>(() => tm('strava.connect.features') as string[])
function unit(n: number, key: string) {
  return `${n} ${t(key, n)}`
}
function relativeTime(s: string | null) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t('strava.time.justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('strava.time.ago', { v: unit(min, 'strava.time.units.minutes') })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('strava.time.ago', { v: unit(hr, 'strava.time.units.hours') })
  const day = Math.floor(hr / 24)
  if (day < 7) return t('strava.time.ago', { v: unit(day, 'strava.time.units.days') })
  const wk = Math.floor(day / 7)
  if (wk < 5) return t('strava.time.ago', { v: unit(wk, 'strava.time.units.weeks') })
  return new Date(s).toLocaleDateString()
}
async function fetchStatus() {
  try {
    const data = await api.strava.status()
    connected.value = Boolean(data.connected)
    lastSyncedAt.value = data.last_synced_at || null
  } catch {
  } finally {
    loading.value = false
  }
}
async function sync() {
  syncing.value = true
  try {
    const data = await api.strava.sync()
    if (data.last_synced_at) lastSyncedAt.value = data.last_synced_at
    else lastSyncedAt.value = new Date().toISOString()
    const imported = data.imported ?? 0
    if (imported > 0) {
      showToast(
        imported === 1
          ? t('strava.sync.importedOne')
          : t('strava.sync.importedOther', { n: imported }),
        { type: 'success' },
      )
    } else {
      showToast(t('strava.sync.upToDate'), { type: 'info' })
    }
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    const msg = apiErrorMessage(err, t('strava.sync.failed'))
    if (status === 429) showToast(msg, { type: 'warning' })
    else if (status === 401) showToast(msg, { type: 'error' })
    else showToast(msg, { type: 'error' })
  } finally {
    syncing.value = false
  }
}
async function disconnect() {
  try {
    await api.strava.disconnect()
    connected.value = false
    setConnected(false)
    clearUser()
    router.replace('/login')
  } catch (error) {
    recordRecoveredError(error)
  }
}
function connect() {
  window.location.href = '/api/strava/authorize'
}
onMounted(() => {
  if (route.query.connected) connected.value = true
  fetchStatus()
})
</script>
