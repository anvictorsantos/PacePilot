<template>
  <div class="flex min-h-screen flex-col bg-background text-primary">
    <header class="flex justify-between items-center mx-auto px-6 py-6 w-full max-w-[1240px]">
      <RouterLink
        to="/"
        class="flex items-center"
        aria-label="PacePilot"
      >
        <BrandLogo />
      </RouterLink>
      <LanguageSwitcher />
    </header>

    <main class="flex flex-1 justify-center px-6 pt-8 pb-20">
      <div class="flex flex-col gap-5 w-full max-w-[400px]">
        <div class="flex flex-col gap-2">
          <h1 class="font-medium text-2xl tracking-tight">{{ title }}</h1>
          <p
            v-if="desc"
            class="text-body text-muted"
          >
            {{ desc }}
          </p>
        </div>

        <slot />

        <RouterLink
          to="/login"
          class="flex items-center gap-2 text-muted hover:text-primary text-label transition"
        >
          <ArrowLeftIcon cls="h-4 w-4" />
          {{ $t('auth.account.backToLogin') }}
        </RouterLink>
      </div>
    </main>

    <footer class="mx-auto px-6 py-6 w-full max-w-[1240px] text-faint text-label">
      {{ $t('common.rights') }}
    </footer>
  </div>
</template>

<script setup lang="ts">
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'

defineProps<{
  title: string
  desc?: string
}>()
</script>
