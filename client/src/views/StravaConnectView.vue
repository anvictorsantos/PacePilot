<template>
  <div class="max-w-xl mx-auto text-center py-10">
    <Skeleton v-if="loading" />
    <template v-else-if="connected">
      <div class="bg-card border border-white/10 rounded-2xl p-8">
        <CheckCircleIcon cls="w-10 h-10 text-success mx-auto mb-2" />
        <h1 class="text-white text-xl font-bold">{{ $t('stravaView.connected') }}</h1>
        <p class="text-muted text-sm mt-2">
          <template v-if="lastSyncedAt">{{ $t('stravaView.lastSync') }}: {{ relativeTime(lastSyncedAt) }}.</template>
          <template v-else>{{ $t('stravaView.never') }}</template>
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <button @click="sync" :disabled="syncing" class="bg-primary hover:bg-primaryBright disabled:opacity-50 text-white font-semibold px-6 py-2.5 min-h-touch rounded-xl transition">{{ syncing ? $t('stravaView.syncing') : $t('stravaView.sync') }}</button>
          <button @click="disconnect" class="bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 min-h-touch rounded-xl transition">{{ $t('stravaView.disconnect') }}</button>
        </div>
      </div>
    </template>
    <template v-else>
      <h1 class="text-white text-2xl font-bold">{{ $t('stravaView.title') }}</h1>
      <p class="text-muted text-sm mt-2">{{ $t('stravaView.desc') }}</p>
      <div class="mt-6 bg-card border border-white/10 rounded-2xl p-6 text-left space-y-2">
        <div class="text-white text-sm font-semibold mb-2">{{ $t('stravaView.useTitle') }}</div>
        <div v-for="item in features" :key="item" class="text-muted text-sm flex gap-2 items-center"><CheckIcon cls="w-4 h-4 shrink-0 text-success" /> {{ item }}</div>
      </div>
      <div class="mt-6">
        <button @click="connect" class="inline-flex items-center gap-2 bg-strava hover:bg-stravaDark text-white font-semibold px-8 py-3 min-h-touch rounded-xl transition"><LinkIcon cls="w-5 h-5" /> {{ $t('login.connect') }}</button>
      </div>
      <p v-if="error" class="text-danger text-sm mt-4">{{ error }}</p>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '@/services/api.js'
import { useToast } from '@/composables/useToast.js'
import { useSession } from '@/composables/useSession.js'
import { useCurrentUser } from '@/composables/useCurrentUser.js'
import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import CheckIcon from '@/components/icons/CheckIcon.vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'

const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const { show: showToast } = useToast()
const { setConnected } = useSession()
const { clearUser } = useCurrentUser()
const connected = ref(false); const loading = ref(true); const syncing = ref(false)
const lastSyncedAt = ref(null)
const error = ref(route.query.error || '')
const features = computed(() => tm('stravaView.features'))
function unit(n, key) {
  return `${n} ${t(key, n)}`
}
function relativeTime(s) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t('stravaView.justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('stravaView.ago', { v: unit(min, 'stravaView.uMin') })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('stravaView.ago', { v: unit(hr, 'stravaView.uHr') })
  const day = Math.floor(hr / 24)
  if (day < 7) return t('stravaView.ago', { v: unit(day, 'stravaView.uDay') })
  const wk = Math.floor(day / 7)
  if (wk < 5) return t('stravaView.ago', { v: unit(wk, 'stravaView.uWk') })
  return new Date(s).toLocaleDateString()
}
async function fetchStatus() { try { const { data } = await api.get('/strava/status'); connected.value = data.connected; lastSyncedAt.value = data.last_synced_at || null } catch {} finally { loading.value = false } }
async function sync() {
  syncing.value = true
  try {
    const { data } = await api.post('/strava/sync')
    if (data.last_synced_at) lastSyncedAt.value = data.last_synced_at
    else lastSyncedAt.value = new Date().toISOString()
    if (data.imported > 0) {
      showToast(data.imported === 1 ? t('stravaView.syncedOne') : t('stravaView.syncedOther', { n: data.imported }), { type: 'success' })
    } else {
      showToast(t('stravaView.upToDate'), { type: 'info' })
    }
  } catch (err) {
    const status = err.response?.status
    const msg = err.response?.data?.error || err.message || t('stravaView.syncFail')
    if (status === 429) showToast(msg, { type: 'warning' })
    else if (status === 401) showToast(msg, { type: 'error' })
    else showToast(msg, { type: 'error' })
  } finally { syncing.value = false }
}
async function disconnect() { try { await api.post('/strava/disconnect'); connected.value = false; setConnected(false); clearUser(); router.replace('/login') } catch {} }
function connect() { window.location.href = '/api/strava/authorize' }
onMounted(() => { if (route.query.connected) connected.value = true; fetchStatus() })
</script>
