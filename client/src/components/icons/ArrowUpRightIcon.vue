<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.8"
    stroke="currentColor"
    :class="cls"
    aria-hidden="true"
  >
    <path
      d="M7 17L17 7M9 7h8v8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
<script setup>
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- heroicons 24/outline ArrowUpRight — https://heroicons.com -->
