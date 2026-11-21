<template>
  <footer
    id="privacy"
    class="flex flex-col gap-8 mx-auto px-6 lg:px-12 py-9 max-w-[1240px] scroll-mt-20"
  >
    <div class="flex justify-between items-start text-faint text-label">
      <p>{{ $t('common.rights') }}</p>

      <div class="flex sm:flex-row flex-col sm:items-center gap-3 sm:gap-5 ml-auto">
        <p class="text-muted text-label">{{ $t('common.brandTagline') }}</p>
        <a
          href="https://buymeacoffee.com/pacepilot"
          target="_blank"
          rel="noopener"
          class="flex items-center self-start gap-2 hover:bg-accent/10 px-4 py-2 border border-white/20 rounded-lg font-mono text-label text-faint transition"
        >
          <CoffeeIcon cls="h-4 w-4" />
          {{ $t('landing.cta.coffee') }}</a
        >
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import CoffeeIcon from '@/components/icons/CoffeeIcon.vue'
</script>
