<template>
  <div class="bg-card border border-white/10 rounded-2xl p-10 text-center">
    <div class="text-3xl mb-3">◯</div>
    <div class="text-white font-semibold">{{ title }}</div>
    <div class="text-muted text-sm mt-1">{{ message }}</div>
    <slot />
  </div>
</template>
<script setup lang="ts">
defineProps({ title: { type: String, default: '' }, message: { type: String, default: '' } })
</script>
