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
        <svg
          class="w-[18px] h-[18px] shrink-0"
          :class="$route.path === item.to ? 'opacity-100' : 'opacity-75'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path :d="item.icon" />
        </svg>
        {{ $t(item.key) }}
      </RouterLink>
    </nav>

    <div class="mt-auto pt-4">
      <UserMenu />
    </div>
  </aside>
</template>

<script setup lang="ts">
import BrandLogo from '@/components/ui/BrandLogo.vue'
import UserMenu from '@/layouts/UserMenu.vue'

const navItems = [
  { to: '/workout', key: 'shell.today', icon: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 8v4l2.5 2' },
  {
    to: '/plan',
    key: 'shell.plan',
    icon: 'M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M4 10h16M9 3v4M15 3v4',
  },
  { to: '/activities', key: 'shell.runs', icon: 'M4 18l5-5 3 3 7-8' },
  { to: '/progress', key: 'shell.progress', icon: 'M5 19V9M12 19V5M19 19v-7' },
  {
    to: '/goals',
    key: 'shell.goals',
    icon: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
  },
  {
    to: '/settings',
    key: 'shell.settings',
    icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 3v3M12 18v3M3 12h3M18 12h3',
  },
]
</script>
