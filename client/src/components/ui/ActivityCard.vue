<template>
  <RouterLink :to="`/activities/${activity.id}`" class="block bg-card border border-white/10 rounded-2xl p-5 hover:border-white/20 transition">
    <div class="flex items-center justify-between">
      <span class="text-primary text-xs font-semibold tracking-widest">RUN</span>
      <span class="text-muted text-xs">{{ dateLabel }}</span>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
      <div><div class="text-white font-bold">{{ activity.distance_km }} km</div><div class="text-muted text-xs">Distance</div></div>
      <div><div class="text-white font-bold">{{ activity.moving_time_min }} min</div><div class="text-muted text-xs">Time</div></div>
      <div><div class="text-white font-bold">{{ paceLabel }}</div><div class="text-muted text-xs">Pace</div></div>
    </div>
    <div class="mt-3 flex items-center gap-2">
      <span class="text-xs px-2 py-1 rounded-full bg-white/10 text-muted">{{ activity.workout_type }}</span>
      <span v-if="activity.avg_hr" class="text-xs text-muted">{{ activity.avg_hr }} bpm</span>
      <span v-if="activity.elevation_m" class="text-xs text-muted">{{ activity.elevation_m }} m ↑</span>
    </div>
  </RouterLink>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ activity: Object })
const dateLabel = computed(() => new Date(props.activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
const paceLabel = computed(() => {
  const s = props.activity.avg_pace_sec_km
  if (!s) return '—'
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} /km`
})
</script>
