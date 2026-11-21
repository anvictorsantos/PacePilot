<template>
  <aside
    class="hidden md:flex flex-col bg-panel border-white/10 border-r w-60 shrink-0 px-4 py-5.5"
  >
    <RouterLink
      to="/"
      class="pl-1.5 mb-7 text-primary"
    >
      <BrandLogo />
    </RouterLink>

    <nav class="flex flex-col gap-1.5">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :aria-current="$route.path === item.to ? 'page' : undefined"
        class="flex items-center gap-3 px-3 h-11 rounded-lg text-lead transition"
        :class="
          $route.path === item.to
            ? 'bg-cardSecondary text-primary'
            : 'text-muted hover:text-primary'
        "
      >
        <component
          :is="item.icon"
          cls="w-[18px] h-[18px] shrink-0"
          :class="$route.path === item.to ? 'opacity-100' : 'opacity-75'"
        />
        {{ $t(item.key) }}
      </RouterLink>
    </nav>

    <div class="mt-auto pt-4">
      <UserMenu />
    </div>
  </aside>
</template>

<script setup lang="ts">
import ActivityIcon from '@/components/icons/ActivityIcon.vue'
import BarChartIcon from '@/components/icons/BarChartIcon.vue'
import CalendarIcon from '@/components/icons/CalendarIcon.vue'
import ClockIcon from '@/components/icons/ClockIcon.vue'
import SettingsIcon from '@/components/icons/SettingsIcon.vue'
import TargetIcon from '@/components/icons/TargetIcon.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import UserMenu from '@/layouts/UserMenu.vue'

const navItems = [
  { to: '/workout', key: 'shell.today', icon: ClockIcon },
  { to: '/plan', key: 'shell.plan', icon: CalendarIcon },
  { to: '/activities', key: 'shell.runs', icon: ActivityIcon },
  { to: '/progress', key: 'shell.progress', icon: BarChartIcon },
  { to: '/goals', key: 'shell.goals', icon: TargetIcon },
  { to: '/settings', key: 'shell.settings', icon: SettingsIcon },
]
</script>
