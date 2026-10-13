<template>
  <nav class="md:hidden fixed bottom-0 inset-x-0 bg-[#0B0B0F] border-t border-white/10 flex justify-around py-2 z-50">
    <RouterLink v-for="item in items" :key="item.to" :to="item.to" class="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px]" :class="$route.path === item.to ? 'text-primary' : 'text-muted'">
      <component :is="item.icon" cls="w-5 h-5" />{{ item.label }}
    </RouterLink>
  </nav>
</template>

<script setup>
import Squares2X2Icon from '@/components/icons/Squares2X2Icon.vue'
import CalendarDaysIcon from '@/components/icons/CalendarDaysIcon.vue'
import PlayCircleIcon from '@/components/icons/PlayCircleIcon.vue'
import QueueListIcon from '@/components/icons/QueueListIcon.vue'
import ChartBarIcon from '@/components/icons/ChartBarIcon.vue'

const items = [
  { to: '/', label: 'Home', icon: Squares2X2Icon },
  { to: '/plan', label: 'Plan', icon: CalendarDaysIcon },
  { to: '/workout', label: 'Workout', icon: PlayCircleIcon },
  { to: '/activities', label: 'Runs', icon: QueueListIcon },
  { to: '/progress', label: 'Progress', icon: ChartBarIcon },
]
</script>
