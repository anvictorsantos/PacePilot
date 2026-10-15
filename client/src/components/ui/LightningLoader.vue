<template>
  <div
    class="flex min-h-[60vh] flex-col items-center justify-center gap-4"
    role="status"
    aria-live="polite"
  >
    <BrandLogo />
    <BoltIcon cls="h-10 w-10 text-primary animate-pulse" />
    <p class="text-sm text-muted">{{ $t('common.loading') }}</p>
  </div>
</template>

<script setup lang="ts">
import BoltIcon from '@/components/icons/BoltIcon.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
</script>
