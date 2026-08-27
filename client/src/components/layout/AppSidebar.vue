<template>
  <!-- Tailwind Plus — Application Shells / Sidebar / Dark sidebar — https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/sidebar -->
  <!-- Adapted to PacePilot palette (#0B0B0F / primary) and existing flex layout (hidden md:flex) -->
  <aside
    class="hidden md:flex flex-col bg-[#0B0B0F] border-white/10 border-r w-[240px] shrink-0"
  >
    <div class="flex flex-col gap-y-5 px-6 pb-4 overflow-y-auto grow">
      <!-- brand (Plus: h-16 shrink-0 items-center) -->
      <div class="flex items-center gap-2 h-16 shrink-0">
        <div
          class="flex justify-center items-center bg-primary rounded-lg w-8 h-8"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            class="w-5 h-5"
          >
            <path
              fill-rule="evenodd"
              d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div>
          <div
            class="font-extrabold text-white text-sm leading-none tracking-tight"
          >
            PACEPILOT
          </div>
          <div
            class="mt-1 text-[11px] text-white/40 leading-none tracking-widest"
          >
            ADAPTIVE COACH
          </div>
        </div>
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
import CalendarDaysIcon from "@/components/icons/CalendarDaysIcon.vue";
import PlayCircleIcon from "@/components/icons/PlayCircleIcon.vue";
import QueueListIcon from "@/components/icons/QueueListIcon.vue";
import ChartBarIcon from "@/components/icons/ChartBarIcon.vue";
import TrophyIcon from "@/components/icons/TrophyIcon.vue";

const navItems = [
  { to: "/workout", label: "Today", icon: PlayCircleIcon },
  { to: "/plan", label: "Plan", icon: CalendarDaysIcon },
  { to: "/activities", label: "Activities", icon: QueueListIcon },
  { to: "/progress", label: "Progress", icon: ChartBarIcon },
  { to: "/goals", label: "Goals", icon: TrophyIcon },
];
</script>
