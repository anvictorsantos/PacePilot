<template>
  <header class="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-background">
    <div>
      <div class="text-muted text-xs tracking-widest">PACEPILOT</div>
      <div class="text-white font-semibold">{{ title }}</div>
    </div>
    <div class="flex items-center gap-3">
      <div v-if="demo" class="text-xs bg-white/10 text-muted px-3 py-1 rounded-full">Demo data</div>

      <!-- notifications — last activities after last sync (Tailwind Plus dropdown list) -->
      <AppDropdown panel-class="right-0 w-80 sm:w-96">
        <template #trigger>
          <button
            type="button"
            class="relative rounded-full p-2 text-muted hover:text-white hover:bg-white/5 transition"
            aria-label="Notifications"
            @click="onBellClick"
          >
            <BellIcon cls="w-5 h-5" />
            <span v-if="newCount > 0" class="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-primary ring-2 ring-background"></span>
            </span>
          </button>
        </template>

        <template #default="{ close }">
          <div class="px-4 py-3 border-b border-white/10">
            <div class="text-white text-sm font-semibold">New after last sync</div>
            <div class="text-muted text-xs mt-0.5">
              <template v-if="lastSyncedAt">Since {{ formatDate(lastSyncedAt) }}</template>
              <template v-else>Recent activities</template>
            </div>
          </div>

          <div v-if="bellLoading" class="px-4 py-8 text-center text-muted text-sm">Loading…</div>
          <div v-else-if="!bellItems.length" class="px-4 py-8 text-center">
            <div class="text-white text-sm">No new activities</div>
            <div class="text-muted text-xs mt-1">You're up to date since last sync.</div>
          </div>
          <ul v-else class="max-h-80 overflow-auto divide-y divide-white/5">
            <li v-for="a in bellItems" :key="a.id || a.strava_activity_id" class="flex gap-3 px-4 py-3 hover:bg-white/5 transition">
              <div class="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <span class="text-primary text-xs font-bold">{{ (a.workout_type || a.type || 'run').slice(0,3).toUpperCase() }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <span class="text-white text-sm font-medium">{{ displayDistance(a) }}</span>
                  <span class="text-muted text-xs">{{ a.workout_type || a.type }}</span>
                  <span class="text-muted text-xs">· {{ formatShortDate(a.date || a.start_date) }}</span>
                </div>
                <div class="text-muted text-xs mt-0.5 truncate">
                  {{ paceFor(a) }} · {{ timeFor(a) }}
                </div>
              </div>
            </li>
          </ul>

          <div class="border-t border-white/10 p-2">
            <RouterLink
              to="/activities"
              class="block text-center text-sm font-medium text-white bg-white/5 hover:bg-white/10 rounded-lg py-2 transition"
              @click="close()"
            >View all activities</RouterLink>
          </div>
        </template>
      </AppDropdown>

      <!-- profile dropdown (Tailwind Plus — Elements / Dropdowns / User menu) -->
      <AppDropdown panel-class="right-0 w-56">
        <template #trigger>
          <button
            type="button"
            class="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/5 transition -mr-1"
            aria-label="User menu"
          >
            <div v-if="currentUser?.profile" class="relative">
              <img
                :src="currentUser.profile"
                :alt="fullName"
                class="w-8 h-8 rounded-full object-cover border border-white/10"
                referrerpolicy="no-referrer"
              />
              <span v-if="stravaConnected" class="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-success ring-2 ring-background"></span>
              </span>
            </div>
            <div v-else class="relative">
              <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">{{ initials }}</div>
              <span v-if="stravaConnected" class="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-success ring-2 ring-background"></span>
              </span>
            </div>
            <span class="hidden sm:block text-white text-sm font-medium max-w-[10rem] truncate">{{ fullName }}</span>
            <ChevronDownIcon cls="w-4 h-4 text-muted shrink-0 hidden sm:block" />
          </button>
        </template>

        <template #default="{ close }">
          <!-- user header -->
          <div class="px-4 py-3 border-b border-white/10">
            <div class="text-white text-sm font-semibold truncate">{{ fullName }}</div>
            <div class="text-muted text-xs truncate">{{ currentUser?.email || 'Athlete' }}</div>
          </div>

          <!-- primary links -->
          <RouterLink
            to="/strava"
            class="flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-white/5 transition"
            @click="close()"
          >
            <LinkIcon cls="w-5 h-5 text-muted" />
            Strava
            <span class="ml-auto h-2 w-2 rounded-full" :class="stravaConnected ? 'bg-success' : 'bg-white/25'"></span>
          </RouterLink>

          <RouterLink
            to="/progress"
            class="flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-white/5 transition"
            @click="close()"
          >
            <ChartBarIcon cls="w-5 h-5 text-muted" />
            Progress
          </RouterLink>

          <!-- settings at the bottom (Plus: divided section) -->
          <div class="border-t border-white/10 mt-1 pt-1">
            <RouterLink
              to="/settings"
              class="flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-white/5 transition"
              @click="close()"
            >
              <Cog6ToothIcon cls="w-5 h-5 text-muted" />
              Settings
            </RouterLink>
          </div>
        </template>
      </AppDropdown>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api.js'
import { useCurrentUser } from '../../composables/useCurrentUser.js'
import AppDropdown from '../ui/AppDropdown.vue'
import BellIcon from '../icons/BellIcon.vue'
import ChevronDownIcon from '../icons/ChevronDownIcon.vue'
import Cog6ToothIcon from '../icons/Cog6ToothIcon.vue'
import LinkIcon from '../icons/LinkIcon.vue'
import ChartBarIcon from '../icons/ChartBarIcon.vue'

const route = useRoute()
const title = computed(() => route.meta.label || 'Dashboard')
const demo = ref(false)
const stravaConnected = ref(false)
const lastSyncedAt = ref(null)
const bellItems = ref([])
const bellLoading = ref(false)
let bellFetched = false
const bellSeen = ref(false)
const { user: currentUser, fetchUser } = useCurrentUser()

const newCount = computed(() => bellSeen.value ? 0 : bellItems.value.length)

const fullName = computed(() => {
  const f = currentUser.value?.firstname || ''
  const l = currentUser.value?.lastname || ''
  const n = `${f} ${l}`.trim()
  return n || 'Athlete'
})
const initials = computed(() => {
  const f = currentUser.value?.firstname?.[0] || ''
  const l = currentUser.value?.lastname?.[0] || ''
  return (f + l).toUpperCase() || 'A'
})

function formatDate(s) {
  if (!s) return ''
  try { return new Date(s).toLocaleString() } catch { return String(s) }
}
function formatShortDate(s) {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString() } catch { return String(s) }
}
function displayDistance(a) {
  const km = a.distance_km ?? (a.distance != null ? (a.distance / 1000).toFixed(2) : null)
  return km != null ? `${km} km` : '—'
}
function paceFor(a) {
  const sec = a.avg_pace_sec_km
  if (sec) return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')} /km`
  if (a.average_speed) return `${(1000/a.average_speed/60).toFixed(1)} /km`
  return '—'
}
function timeFor(a) {
  if (a.moving_time_min) return `${a.moving_time_min} min`
  if (a.moving_time) return `${Math.round(a.moving_time/60)} min`
  return ''
}

async function fetchBell(force = false) {
  if (bellFetched && !force) return
  bellLoading.value = true
  try {
    const { data } = await api.get('/activities', { params: { perPage: 10 } })
    const items = data.items || data || []
    const cutoff = lastSyncedAt.value ? new Date(lastSyncedAt.value).getTime() : null
    const next = cutoff
      ? items.filter(a => new Date(a.date || a.start_date).getTime() > cutoff)
      : items.slice(0, 6)
    // if new items arrived after dismissal, re-show the dot
    if (next.length && bellSeen.value && next.length !== bellItems.value.length) bellSeen.value = false
    else if (!bellSeen.value && next.length === 0) { /* keep hidden if nothing new */ }
    bellItems.value = next
    bellFetched = true
  } catch { bellItems.value = [] }
  finally { bellLoading.value = false }
}

async function onBellClick() {
  if (!bellFetched) await fetchBell()
  if (bellItems.value.length) bellSeen.value = true
}

onMounted(async () => {
  fetchUser()
  try { const { data } = await api.get('/health'); demo.value = data.demo } catch {}
  try {
    const { data } = await api.get('/strava/status')
    stravaConnected.value = data.connected
    lastSyncedAt.value = data.last_synced_at || null
  } catch {}
  // prefetch quietly so badge is accurate on load (dot shows before click)
  await fetchBell()
  // poll so a newly synced activity shows the dot without needing to click Refresh
  setInterval(() => fetchBell(true), 30000)
})
</script>
