<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    :class="cls"
    role="img"
    aria-label="PacePilot mark"
  >
    <rect
      width="32"
      height="32"
      rx="7"
      fill="#0B0B0F"
    />
    <!-- bolt: heroicons 24/solid BoltIcon — https://heroicons.com -->
    <path
      fill="#F97316"
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z"
      transform="translate(4 4)"
    />
  </svg>
</template>
<script setup lang="ts">
defineProps({ cls: { type: String, default: 'w-8 h-8' } })
</script>
<!-- App favicon mark: BoltIcon 24/solid (https://heroicons.com) on PacePilot bg #0B0B0F / primary #F97316 -->
