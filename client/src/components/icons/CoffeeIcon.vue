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
      d="M4 8h12v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8zm12 1h2a2.5 2.5 0 010 5h-2M7 4.5c0-1 .8-1 .8-2M11 4.5c0-1 .8-1 .8-2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
<script setup>
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- Coffee cup for Buy-Me-a-Coffee support link (custom, PacePilot palette) -->
