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
      d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h11.25A2.25 2.25 0 0117.25 5.25v11.25M3.75 3h11.25M16.5 16.5L12 12.75 8.25 16.5M16.5 16.5v-3.375a1.5 1.5 0 00-1.5-1.5h-1.5M8.25 16.5v-3.375A1.5 1.5 0 019.75 11.625h1.5"
    />
  </svg>
</template>
<script setup lang="ts">
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- heroicons 24/outline — https://heroicons.com (chart) -->
