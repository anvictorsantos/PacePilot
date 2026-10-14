<template>
  <!-- Tailwind Plus — Application Shells / Sidebar / Dark sidebar — https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/sidebar -->
  <!-- Adapted to PacePilot palette (#0B0B0F / primary) and existing flex layout (hidden md:flex) -->
  <aside
    class="hidden md:flex flex-col bg-background border-white/10 border-r w-[240px] shrink-0"
  >
    <div class="flex flex-col gap-y-5 px-6 pb-4 overflow-y-auto grow">
      <!-- brand (Plus: h-16 shrink-0 items-center) -->
      <div class="flex items-center gap-2 h-16 shrink-0">
        <BrandLogo />
      </div>

      <nav class="flex flex-col flex-1">
        <ul role="list" class="flex flex-col flex-1 gap-y-7">
          <!-- primary nav group -->
          <li>
            <ul role="list" class="space-y-1 -mx-2">
              <li v-for="item in navItems" :key="item.to">
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
                      $route.path === item.to
                        ? 'text-white'
                        : 'text-muted group-hover:text-white'
                    "
                  />
                  {{ item.label }}
                </RouterLink>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  </aside>
</template>

<script setup>
import BrandLogo from "@/components/ui/BrandLogo.vue";
import CalendarDaysIcon from "@/components/icons/CalendarDaysIcon.vue";
import PlayCircleIcon from "@/components/icons/PlayCircleIcon.vue";
import QueueListIcon from "@/components/icons/QueueListIcon.vue";
import ChartBarIcon from "@/components/icons/ChartBarIcon.vue";
import TrophyIcon from "@/components/icons/TrophyIcon.vue";

const navItems = [
  { to: "/workout", label: "Today", icon: PlayCircleIcon },
  { to: "/plan", label: "Plan", icon: CalendarDaysIcon },
  { to: "/progress", label: "Progress", icon: ChartBarIcon },
  { to: "/activities", label: "Activities", icon: QueueListIcon },
  { to: "/goals", label: "Goals", icon: TrophyIcon },
];
</script>
