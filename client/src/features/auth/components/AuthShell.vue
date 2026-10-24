<template>
  <div class="flex min-h-screen flex-col bg-background text-white">
    <header class="flex justify-between items-center mx-auto px-6 py-6 w-full max-w-shell">
      <RouterLink
        to="/"
        class="flex items-center"
        aria-label="PacePilot"
      >
        <BrandLogo />
      </RouterLink>
      <LanguageSwitcher />
    </header>

    <main class="flex flex-1 justify-center items-center px-6 py-10">
      <div class="flex flex-col gap-6 w-full max-w-[440px]">
        <div class="flex flex-col gap-4">
          <p class="font-bold text-label text-primary">{{ kicker }}</p>
          <h1 class="font-extrabold text-5xl leading-display">{{ title }}</h1>
          <p
            v-if="desc"
            class="text-lead text-muted leading-loose"
          >
            {{ desc }}
          </p>
        </div>

        <slot />

        <RouterLink
          to="/login"
          class="flex items-center gap-2 text-muted hover:text-white text-xs transition"
        >
          <ArrowLeftIcon cls="h-4 w-4" />
          {{ $t('auth.account.backToLogin') }}
        </RouterLink>
      </div>
    </main>

    <footer class="mx-auto px-6 py-6 w-full max-w-shell text-faint text-label">
      {{ $t('common.rights') }}
    </footer>
  </div>
</template>

<script setup lang="ts">
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'

defineProps<{
  kicker: string
  title: string
  desc?: string
}>()
</script>
