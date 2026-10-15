<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.7"
    stroke="currentColor"
    :class="cls"
    aria-hidden="true"
  >
    <path
      d="M3 12h4l2.5-7 4 14 2.5-7H21"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
<script setup lang="ts">
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- Effort/pulse motif for feedback rows (custom, PacePilot palette) -->
