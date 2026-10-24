<template>
  <!-- Shared brand lockup — single source for logo image + wordmark on every page -->
  <span class="flex items-center gap-2.5">
    <img
      src="/favicon.svg"
      alt="PacePilot logo"
      class="w-16 h-16 shrink-0"
    />
    <span
      v-if="showText"
      class="font-extrabold text-title text-white tracking-tight"
      >PacePilot</span
    >
  </span>
</template>

<script setup lang="ts">
defineProps({
  /** Render the PacePilot wordmark next to the logo. */
  showText: { type: Boolean, default: true },
})
</script>
