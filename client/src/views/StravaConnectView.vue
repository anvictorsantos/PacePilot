<template>
  <div class="max-w-xl mx-auto text-center py-10">
    <Skeleton v-if="loading" />
    <template v-else-if="connected">
      <div class="bg-card border border-white/10 rounded-2xl p-8">
        <CheckCircleIcon cls="w-10 h-10 text-success mx-auto mb-2" />
        <h1 class="text-white text-xl font-bold">Strava Connected</h1>
        <p class="text-muted text-sm mt-2">
          <template v-if="lastSyncedAt">Last sync: {{ relativeTime(lastSyncedAt) }}. Keep your data in sync.</template>
          <template v-else>Never synced. Keep your data in sync.</template>
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <button @click="sync" :disabled="syncing" class="bg-primary hover:bg-primaryBright disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition">{{ syncing ? 'Syncing…' : 'Sync Now' }}</button>
          <button @click="disconnect" class="bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 rounded-xl transition">Disconnect</button>
        </div>
      </div>
    </template>
    <template v-else>
      <h1 class="text-white text-2xl font-bold">Connect Strava</h1>
      <p class="text-muted text-sm mt-2">Give your coach access to your running history.</p>
      <div class="mt-6 bg-card border border-white/10 rounded-2xl p-6 text-left space-y-2">
        <div class="text-white text-sm font-semibold mb-2">We'll use your activities to understand:</div>
        <div v-for="item in features" :key="item" class="text-muted text-sm flex gap-2 items-center"><CheckIcon cls="w-4 h-4 shrink-0 text-success" /> {{ item }}</div>
      </div>
      <div class="mt-6">
        <button @click="connect" class="inline-flex items-center gap-2 bg-strava hover:bg-stravaDark text-white font-semibold px-8 py-3 rounded-xl transition"><LinkIcon cls="w-5 h-5" /> Connect with Strava</button>
      </div>
      <p v-if="error" class="text-danger text-sm mt-4">{{ error }}</p>
    </template>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const { show: showToast } = useToast()
const { setConnected } = useSession()
const { clearUser } = useCurrentUser()
const connected = ref(false); const loading = ref(true); const syncing = ref(false)
const lastSyncedAt = ref(null)
const error = ref(route.query.error || '')
const features = ['Training volume','Running frequency','Pace','Heart rate','Elevation','Workout structure','Training progression']
function relativeTime(s) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk} week${wk === 1 ? '' : 's'} ago`
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
      showToast(`Synced ${data.imported} new activit${data.imported === 1 ? 'y' : 'ies'}${data.totalFetched ? ` (${data.totalFetched} fetched)` : ''}`, { type: 'success' })
    } else {
      showToast('Already up to date — no new activities', { type: 'info' })
    }
  } catch (err) {
    const status = err.response?.status
    const msg = err.response?.data?.error || err.message || 'Sync failed'
    if (status === 429) showToast(msg, { type: 'warning' })
    else if (status === 401) showToast(msg, { type: 'error' })
    else showToast(msg, { type: 'error' })
  } finally { syncing.value = false }
}
async function disconnect() { try { await api.post('/strava/disconnect'); connected.value = false; setConnected(false); clearUser(); router.replace('/login') } catch {} }
function connect() { window.location.href = '/api/strava/authorize' }
onMounted(() => { if (route.query.connected) connected.value = true; fetchStatus() })
</script>
