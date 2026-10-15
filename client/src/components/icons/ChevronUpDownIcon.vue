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
      d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
    />
  </svg>
</template>
<script setup>
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- heroicons 24/outline ChevronUpDown — https://heroicons.com -->
