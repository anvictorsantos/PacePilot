<template>
  <Skeleton v-if="loading" />
  <div v-else class="bg-card border border-white/10 rounded-2xl p-5">
    <div class="text-muted text-xs tracking-widest uppercase mb-1">{{ label }}</div>
    <div class="text-white text-2xl font-bold">{{ value }}</div>
    <div v-if="sub" class="text-muted text-xs mt-1">{{ sub }}</div>
  </div>
</template>
<script setup>
import Skeleton from '@/components/ui/Skeleton.vue'
defineProps({ label: String, value: [String, Number], sub: String, loading: Boolean })
</script>
