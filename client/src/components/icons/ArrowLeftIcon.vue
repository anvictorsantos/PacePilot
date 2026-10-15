<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    :class="cls"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
    />
  </svg>
</template>
<script setup lang="ts">
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- heroicons 24/outline ArrowLeft — https://heroicons.com -->
