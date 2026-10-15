<template>
  <header class="border-white/10 border-b">
    <div class="flex items-center gap-8 mx-auto px-6 lg:px-20 max-w-shell h-[88px]">
      <RouterLink
        to="/"
        class="flex items-center gap-2.5 shrink-0"
      >
        <BrandLogo />
      </RouterLink>
      <div class="flex items-center gap-3 sm:gap-6 ml-auto">
        <LanguageSwitcher />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
</script>
