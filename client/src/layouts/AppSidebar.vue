<template>
  <!-- Tailwind Plus — Application Shells / Sidebar / Dark sidebar — https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/sidebar -->
  <!-- Adapted to PacePilot palette (#0B0B0F / primary) and existing flex layout (hidden md:flex) -->
  <aside class="hidden md:flex flex-col bg-background border-white/10 border-r w-[240px] shrink-0">
    <div class="flex flex-col gap-y-5 px-6 pb-4 overflow-y-auto grow">
      <!-- brand (Plus: h-16 shrink-0 items-center) -->
      <div class="flex items-center gap-2 h-16 shrink-0">
        <RouterLink to="/">
          <BrandLogo />
        </RouterLink>
      </div>

      <nav class="flex flex-col flex-1">
        <ul class="flex flex-col flex-1 gap-y-7">
          <!-- primary nav group -->
          <li>
            <ul class="space-y-1 -mx-2">
              <li
                v-for="item in navItems"
                :key="item.to"
              >
                <RouterLink
                  :to="item.to"
                  :aria-current="$route.path === item.to ? 'page' : undefined"
                  class="group flex gap-x-3 p-2.5 rounded-xl text-sm leading-6 transition"
                  :class="
                    $route.path === item.to
                      ? 'bg-primary text-white font-semibold'
                      : 'text-muted hover:bg-white/5 hover:text-white'
                  "
                >
                  <component
                    :is="item.icon"
                    cls="h-5 w-5 shrink-0"
                    :class="
                      $route.path === item.to ? 'text-white' : 'text-muted group-hover:text-white'
                    "
                  />
                  {{ $t(item.key) }}
                </RouterLink>
              </li>

              <!-- settings: last navigation item (Figma Navigation item) -->
              <li>
                <RouterLink
                  to="/settings"
                  :aria-current="$route.path === '/settings' ? 'page' : undefined"
                  class="group flex items-center gap-2.5 p-3 rounded-card font-bold text-body leading-4 transition"
                  :class="
                    $route.path === '/settings'
                      ? 'bg-track text-white'
                      : 'text-muted hover:bg-white/5 hover:text-white'
                  "
                >
                  <Cog6ToothIcon
                    cls="h-4.5 w-4.5 shrink-0"
                    :class="
                      $route.path === '/settings'
                        ? 'text-primary'
                        : 'text-muted group-hover:text-white'
                    "
                  />
                  {{ $t('shell.settings') }}
                </RouterLink>
              </li>
            </ul>
          </li>
        </ul>

        <!-- divider after settings (Figma Divider) -->
        <div
          class="my-4 border-white/10 border-t"
          role="separator"
        ></div>

        <!-- athlete menu pinned to the bottom of the sidebar -->
        <div class="mt-auto pt-4">
          <UserMenu />
        </div>
      </nav>
    </div>
  </aside>
</template>

<script setup lang="ts">
import CalendarDaysIcon from '@/components/icons/CalendarDaysIcon.vue'
import ChartBarIcon from '@/components/icons/ChartBarIcon.vue'
import Cog6ToothIcon from '@/components/icons/Cog6ToothIcon.vue'
import PlayCircleIcon from '@/components/icons/PlayCircleIcon.vue'
import QueueListIcon from '@/components/icons/QueueListIcon.vue'
import TrophyIcon from '@/components/icons/TrophyIcon.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import UserMenu from '@/layouts/UserMenu.vue'

const navItems = [
  { to: '/workout', key: 'shell.today', icon: PlayCircleIcon },
  { to: '/plan', key: 'shell.plan', icon: CalendarDaysIcon },
  { to: '/progress', key: 'shell.progress', icon: ChartBarIcon },
  { to: '/activities', key: 'shell.runs', icon: QueueListIcon },
  { to: '/goals', key: 'shell.goals', icon: TrophyIcon },
]
</script>
