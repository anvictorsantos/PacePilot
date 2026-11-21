<template>
  <header class="border-white/10 border-b">
    <div class="flex items-center gap-4 sm:gap-8 mx-auto px-4 sm:px-8 max-w-[1240px] h-[70px]">
      <RouterLink
        to="/"
        class="flex items-center gap-2.5 shrink-0 text-primary"
      >
        <BrandLogo />
      </RouterLink>
      <nav class="hidden md:flex items-center gap-6.5 mx-auto text-body">
        <a
          href="#plan"
          class="text-muted hover:text-primary transition"
          >{{ $t('shell.plan') }}</a
        >
        <a
          href="#progress"
          class="text-muted hover:text-primary transition"
          >{{ $t('shell.progress') }}</a
        >
        <a
          href="#activities"
          class="text-muted hover:text-primary transition"
          >{{ $t('shell.runs') }}</a
        >
      </nav>
      <div class="flex items-center gap-3 sm:gap-4.5 ml-auto md:ml-0">
        <LanguageSwitcher />
        <template v-if="authenticated">
          <RouterLink
            to="/workout"
            class="inline-flex justify-center items-center bg-primary hover:brightness-110 px-4 py-2.5 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-medium text-body text-background transition"
          >
            {{ $t('nav.myAccount') }}
          </RouterLink>
        </template>
        <template v-else>
          <RouterLink
            to="/login"
            class="hidden sm:inline-flex text-muted hover:text-primary text-body transition"
          >
            {{ $t('nav.login') }}
          </RouterLink>
          <RouterLink
            :to="{ path: '/login', query: { mode: 'register' } }"
            class="inline-flex justify-center items-center bg-primary hover:brightness-110 px-4 py-2.5 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-medium text-body text-background transition"
          >
            {{ $t('nav.register') }}
          </RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'

const { authenticated, ensure } = useAuth()

// The landing page is public; the session read decides between the two calls to action.
onMounted(() => {
  void ensure()
})
</script>
