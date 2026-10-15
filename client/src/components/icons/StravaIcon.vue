<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 25 25"
    fill="none"
    :class="cls"
    aria-hidden="true"
  >
    <path
      d="M9 0L18 16H12L9 10L6 16H0L9 0ZM18 25L11 13H16L18 17L20 13H25L18 25Z"
      fill="currentColor"
    />
  </svg>
</template>
<script setup lang="ts">
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- Strava brand mark (brand asset, not heroicons) — white on Strava orange button -->
