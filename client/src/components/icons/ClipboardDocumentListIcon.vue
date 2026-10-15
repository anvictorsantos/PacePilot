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
      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a1.125 1.125 0 011.125 1.125v3.375c0 .621.504 1.125 1.125 1.125h3.375a1.125 1.125 0 011.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H15a1.125 1.125 0 011.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125h-1.5a1.125 1.125 0 00-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125h1.5a1.125 1.125 0 011.125 1.125z"
    />
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 10.5h1.5m-1.5 3h1.5m-6-3h1.5m-1.5 3h1.5M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.375A1.125 1.125 0 0114.625 17.625V21"
    />
  </svg>
</template>
<script setup>
defineProps({ cls: { type: String, default: 'w-5 h-5' } })
</script>
<!-- heroicons 24/outline — https://heroicons.com (simplified) -->
