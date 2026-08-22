<template>
  <RouterLink :to="`/activities/${activityId}`" class="block bg-card border border-white/10 rounded-2xl p-5 hover:border-white/20 transition">
    <div class="flex items-center justify-between">
      <span class="text-primary text-xs font-semibold tracking-widest">RUN</span>
      <span class="text-muted text-xs">{{ dateLabel }}</span>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
      <div><div class="text-white font-bold">{{ activity.distance_km }} km</div><div class="text-muted text-xs">Distance</div></div>
      <div><div class="text-white font-bold">{{ activity.moving_time_min }} min</div><div class="text-muted text-xs">Time</div></div>
      <div><div class="text-white font-bold">{{ paceLabel }}</div><div class="text-muted text-xs">Pace</div></div>
    </div>
    <div class="mt-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="text-xs px-2 py-1 rounded-full bg-primary text-white">{{ activity.workout_type }}</span>
        <span v-if="activity.avg_hr" class="text-xs text-muted">{{ activity.avg_hr }} bpm</span>
        <span v-if="activity.elevation_m" class="text-xs text-muted">{{ activity.elevation_m }} m <span class="text-primary">↑</span></span>
      </div>
      <span v-if="trophyCount" class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 shrink-0">
        <TrophyIcon cls="w-3.5 h-3.5 text-primary shrink-0" />
        {{ trophyCount }}
      </span>
    </div>
  </RouterLink>
</template>
<script setup>
import { computed } from 'vue'
import TrophyIcon from '../icons/TrophyIcon.vue'

const props = defineProps({ activity: Object })
const activityId = computed(() => props.activity.strava_activity_id ?? props.activity.id ?? props.activity._id)
const dateLabel = computed(() => new Date(props.activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
const paceLabel = computed(() => {
  const s = props.activity.avg_pace_sec_km
  if (!s) return '—'
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} /km`
})

// Trophies from Strava GET /activities/{id}?include_all_efforts=true → segment_efforts.achievements
const trophyCount = computed(() => {
  const a = props.activity
  if (a.trophies?.length) return a.trophies.length
  if (a.achievement_count) return a.achievement_count
  return 0
})
</script>
