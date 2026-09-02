<template>
  <div class="bg-card border border-white/10 rounded-2xl p-6">
    <div class="text-primary text-xs tracking-widest font-semibold mb-2">TODAY'S WORKOUT</div>
    <div class="text-white text-2xl font-bold">{{ workout?.recommendation?.type?.toUpperCase() || '—' }}</div>
    <div class="text-white/60 text-sm mt-1">{{ workout?.recommendation?.distance_km }} km · {{ workout?.recommendation?.intensity }}</div>
    <p class="text-muted text-sm mt-3">{{ workout?.recommendation?.purpose }}</p>
    <RouterLink to="/workout" class="mt-5 inline-flex items-center justify-center w-full bg-primary hover:bg-primaryBright text-white font-semibold py-3 rounded-xl transition">View Workout</RouterLink>
  </div>
</template>
<script setup>
defineProps({ workout: Object })
</script>
