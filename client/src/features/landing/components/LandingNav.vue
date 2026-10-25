<template>
  <header class="border-white/10 border-b">
    <div
      class="flex items-center gap-4 sm:gap-8 mx-auto px-4 sm:px-6 lg:px-20 max-w-shell h-[88px]"
    >
      <RouterLink
        to="/"
        class="[&_span>span]:hidden sm:[&_span>span]:inline flex items-center gap-2.5 shrink-0"
      >
        <BrandLogo />
      </RouterLink>
      <div class="flex items-center gap-2 sm:gap-4 ml-auto">
        <LanguageSwitcher />
        <div class="flex items-center gap-1.5 sm:gap-2">
          <RouterLink
            v-if="authenticated"
            to="/settings"
            class="inline-flex justify-center items-center bg-primary hover:brightness-110 px-2.5 sm:px-4 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-bold text-body text-white transition"
          >
            {{ $t('nav.myAccount') }}
          </RouterLink>
          <template v-else>
            <RouterLink
              to="/login"
              class="inline-flex justify-center items-center hover:bg-cardSecondary px-2.5 sm:px-4 border border-none rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-semibold text-body text-white transition"
            >
              {{ $t('nav.login') }}
            </RouterLink>
            <RouterLink
              :to="{ path: '/login', query: { mode: 'register' } }"
              class="inline-flex justify-center items-center bg-primary hover:brightness-110 px-2.5 sm:px-4 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-bold text-body text-white transition"
            >
              {{ $t('nav.register') }}
            </RouterLink>
          </template>
        </div>
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

// The landing page is public; the session read decides between the two calls to
// action. Read once per page load, like every other surface.
onMounted(() => {
  void ensure()
})
</script>
