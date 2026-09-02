<template>
  <!-- Tailwind Plus — Application Shells / Sidebar / Dark sidebar — https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/sidebar -->
  <!-- Adapted to PacePilot palette (#0B0B0F / primary) and existing flex layout (hidden md:flex) -->
  <aside class="hidden md:flex w-[240px] shrink-0 flex-col bg-[#0B0B0F] border-r border-white/10">
    <div class="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-4">
      <!-- brand (Plus: h-16 shrink-0 items-center) -->
      <div class="flex h-16 shrink-0 items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="h-5 w-5"><path fill-rule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clip-rule="evenodd" /></svg>
        </div>
        <div>
          <div class="text-white text-sm font-extrabold tracking-tight leading-none">PACEPILOT</div>
          <div class="text-white/40 text-[11px] tracking-widest leading-none mt-1">ADAPTIVE COACH</div>
        </div>
      </div>

      <nav class="flex flex-1 flex-col">
        <ul role="list" class="flex flex-1 flex-col gap-y-7">
          <!-- primary nav group -->
          <li>
            <ul role="list" class="-mx-2 space-y-1">
              <li v-for="item in navItems" :key="item.to">
                <RouterLink
                  :to="item.to"
                  :aria-current="$route.path === item.to ? 'page' : undefined"
                  class="group flex gap-x-3 rounded-xl p-2.5 text-sm leading-6 transition"
                  :class="$route.path === item.to ? 'bg-primary text-white font-semibold' : 'text-muted hover:bg-white/5 hover:text-white'"
                >
                  <component :is="item.icon" cls="h-5 w-5 shrink-0" :class="$route.path === item.to ? 'text-white' : 'text-muted group-hover:text-white'" />
                  {{ item.label }}
                </RouterLink>
              </li>
            </ul>
          </li>

          <!-- secondary group: account (Plus: mt-auto) -->
          <li class="mt-auto">
            <div class="text-[11px] font-semibold leading-6 text-white/30 tracking-widest">Account</div>
            <ul role="list" class="-mx-2 mt-2 space-y-1">
              <li>
                <RouterLink
                  to="/settings"
                  :aria-current="$route.path === '/settings' ? 'page' : undefined"
                  class="group flex gap-x-3 rounded-xl p-2.5 text-sm leading-6 transition"
                  :class="$route.path === '/settings' ? 'bg-primary text-white font-semibold' : 'text-muted hover:bg-white/5 hover:text-white'"
                >
                  <Cog6ToothIcon cls="h-5 w-5 shrink-0" :class="$route.path === '/settings' ? 'text-white' : 'text-muted group-hover:text-white'" />
                  Settings
                </RouterLink>
              </li>
              <li>
                <RouterLink
                  to="/strava"
                  :aria-current="$route.path === '/strava' ? 'page' : undefined"
                  class="group flex gap-x-3 rounded-xl p-2.5 text-sm leading-6"
                  :class="$route.path === '/strava' ? 'bg-primary text-white font-semibold' : 'text-muted hover:bg-white/5 hover:text-white'"
                >
                  <LinkIcon cls="h-5 w-5 shrink-0" :class="$route.path === '/strava' ? 'text-white' : 'text-muted group-hover:text-white'" />
                  <span class="flex-1">Strava</span>
                  <span class="w-2 h-2 rounded-full self-center" :class="stravaConnected ? 'bg-success' : 'bg-white/25'"></span>
                </RouterLink>
              </li>
            </ul>
            <div class="mt-2 flex items-center gap-1.5 px-2 text-[11px] text-white/30">
              <span class="h-1.5 w-1.5 rounded-full" :class="stravaConnected ? 'bg-success' : 'bg-white/25'"></span>
              {{ stravaConnected ? 'Connected' : 'Not connected' }}
            </div>
          </li>
        </ul>
      </nav>
    </div>
  </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api.js'
import Squares2X2Icon from '../icons/Squares2X2Icon.vue'
import CalendarDaysIcon from '../icons/CalendarDaysIcon.vue'
import PlayCircleIcon from '../icons/PlayCircleIcon.vue'
import QueueListIcon from '../icons/QueueListIcon.vue'
import ChartBarIcon from '../icons/ChartBarIcon.vue'
import TrophyIcon from '../icons/TrophyIcon.vue'
import Cog6ToothIcon from '../icons/Cog6ToothIcon.vue'
import LinkIcon from '../icons/LinkIcon.vue'

const stravaConnected = ref(false)
const navItems = [
  { to: '/', label: 'Dashboard', icon: Squares2X2Icon },
  { to: '/plan', label: 'Training Plan', icon: CalendarDaysIcon },
  { to: '/workout', label: "Today's Workout", icon: PlayCircleIcon },
  { to: '/activities', label: 'Activities', icon: QueueListIcon },
  { to: '/progress', label: 'Progress', icon: ChartBarIcon },
  { to: '/goals', label: 'Goals', icon: TrophyIcon },
]
onMounted(async () => {
  try { const { data } = await api.get('/strava/status'); stravaConnected.value = data.connected } catch {}
})
</script>
