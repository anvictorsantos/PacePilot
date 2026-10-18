<template>
  <nav
    class="md:hidden fixed bottom-0 inset-x-0 bg-background border-t border-white/10 flex justify-around py-2 z-50"
    aria-label="Main navigation"
  >
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-h-touch min-w-[44px] text-label focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      :class="$route.path === item.to ? 'text-primary' : 'text-muted'"
      :aria-current="$route.path === item.to ? 'page' : undefined"
    >
      <component
        :is="item.icon"
        cls="w-5 h-5"
      />{{ $t(item.key) }}
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import CalendarDaysIcon from '@/components/icons/CalendarDaysIcon.vue'
import ChartBarIcon from '@/components/icons/ChartBarIcon.vue'
import PlayCircleIcon from '@/components/icons/PlayCircleIcon.vue'
import QueueListIcon from '@/components/icons/QueueListIcon.vue'

const items = [
  { to: '/workout', key: 'shell.today', icon: PlayCircleIcon },
  { to: '/plan', key: 'shell.plan', icon: CalendarDaysIcon },
  { to: '/activities', key: 'shell.runs', icon: QueueListIcon },
  { to: '/progress', key: 'shell.progress', icon: ChartBarIcon },
]
</script>
