<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <!-- Total Distance -->
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">Total Distance</p>
      <div class="flex flex-col gap-1">
        <p class="text-title font-black leading-none text-white">{{ data.totalDistance }} <span class="text-sm font-bold">km</span></p>
        <p class="text-label font-normal text-muted">All time</p>
      </div>
    </div>
    <!-- Activities -->
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">Activities</p>
      <div class="flex flex-col gap-1">
        <p class="text-title font-black leading-none text-white">{{ data.totalActivities }}</p>
        <p class="text-label font-normal text-muted">Synced runs</p>
      </div>
    </div>
    <!-- Trend -->
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">Trend</p>
      <div class="flex flex-col gap-2">
        <span class="inline-flex self-start rounded bg-white/[0.06] px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wide text-muted">{{ data.trainingState.trend }}</span>
        <p class="text-label font-normal text-muted capitalize">{{ data.trainingState.trend }} phase</p>
      </div>
    </div>
    <!-- Long Run -->
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">Long Run</p>
      <div class="flex flex-col gap-1">
        <p class="text-title font-black leading-none text-white">{{ data.trainingState.weekly.longRun28 }} <span class="text-sm font-bold">km</span></p>
        <p class="text-label font-normal text-muted">28-day best</p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  data: { type: Object, required: true },
})
</script>
