<template>
  <Skeleton v-if="loading" />
  <RouterLink
    v-else
    :to="`/activities/${activityId}`"
    class="bg-card border border-white/10 rounded-2xl p-5 flex flex-col gap-5 w-full hover:border-white/20 transition"
  >
    <!-- workout-type-row 9:536 -->
    <div class="flex items-center justify-between gap-3">
      <span class="bg-primary/[0.13] px-2.5 py-1 rounded-[6px] font-bold text-primary text-[11px] tracking-wide uppercase">{{
        workoutLabel
      }}</span>
      <span class="flex items-center gap-1.5 shrink-0">
        <span class="w-2 h-2 rounded-full shrink-0" :class="dotClass"></span>
        <span class="font-semibold text-muted text-[13px] whitespace-nowrap">{{ intensityLabel }}</span>
      </span>
    </div>

    <!-- workout-target-details 9:542 -->
    <div class="flex flex-col gap-1">
      <p class="leading-none">
        <span class="font-black text-white text-[48px] leading-none">{{ distanceLabel }}</span>
        <span class="font-bold text-white text-2xl leading-none"> km</span>
      </p>
      <p class="text-muted text-sm">
        {{ activity.moving_time_min ?? '—' }} min · Avg
        <span class="font-bold text-white">{{ paceLabel }}</span>
        <span v-if="activity.avg_hr"> · {{ activity.avg_hr }} bpm</span>
      </p>
    </div>

    <!-- workout-phases 9:545 — repurposed as key metrics -->
    <div class="flex gap-3">
      <div class="flex-1 min-w-0 bg-background border border-white/10 rounded-[10px] p-3 flex flex-col gap-1">
        <p class="font-semibold text-muted text-[10px] uppercase tracking-wide leading-none">Distance</p>
        <p class="font-bold text-white text-[15px] leading-none">{{ distanceLabel }} km</p>
        <p class="font-normal text-muted text-[11px] leading-none truncate">{{ dateLabel }}</p>
      </div>
      <div class="flex-1 min-w-0 bg-primary/[0.13] border border-primary rounded-[10px] p-3 flex flex-col gap-1">
        <p class="font-semibold text-primary text-[10px] uppercase tracking-wide leading-none">Avg Pace</p>
        <p class="font-bold text-white text-[15px] leading-none">{{ paceLabel }}</p>
        <p class="font-normal text-primary text-[11px] leading-none truncate">
          {{ activity.avg_hr ? activity.avg_hr + ' bpm avg' : 'Steady' }}
        </p>
      </div>
      <div class="flex-1 min-w-0 bg-background border border-white/10 rounded-[10px] p-3 flex flex-col gap-1">
        <p class="font-semibold text-muted text-[10px] uppercase tracking-wide leading-none">Time</p>
        <p class="font-bold text-white text-[15px] leading-none">{{ activity.moving_time_min ?? '—' }} min</p>
        <p class="font-normal text-muted text-[11px] leading-none truncate">
          {{ activity.elevation_m != null ? activity.elevation_m + ' m ↑' : 'Elapsed' }}
        </p>
      </div>
    </div>

    <!-- coaching-section 9:558 — [word-break:break-word] border-t gap-[6px] pt-[12px] text-[#a1a1aa] -->
    <div class="border-t border-white/10 pt-[12px] flex flex-col gap-[6px] text-muted">
      <div class="flex items-center justify-between gap-2">
        <p class="font-bold text-muted text-[11px] uppercase leading-normal w-full">Run details</p>
        <span
          v-if="trophyCount"
          class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 shrink-0"
        >
          <TrophyIcon cls="w-3.5 h-3.5 text-primary shrink-0" />
          {{ trophyCount }}
        </span>
      </div>
      <p class="font-normal text-muted text-[13px] leading-[1.4] w-full">
        {{ dateLabel }}<span v-if="activity.elevation_m"> · {{ activity.elevation_m }}m elev</span
        ><span v-if="activity.avg_cadence"> · {{ activity.avg_cadence }} spm</span
        ><span v-if="activity.workout_type"> · {{ activity.workout_type }}</span> — tap to view splits, HR and map.
      </p>
    </div>
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import TrophyIcon from '@/components/icons/TrophyIcon.vue'

const props = defineProps({ activity: Object, loading: Boolean })
const activityId = computed(() => props.activity?.strava_activity_id ?? props.activity?.id ?? props.activity?._id)
const dateLabel = computed(() =>
  props.activity?.date
    ? new Date(props.activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
)
const paceLabel = computed(() => {
  const s = props.activity?.avg_pace_sec_km
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`
})
const distanceLabel = computed(() => {
  const d = props.activity?.distance_km
  return d != null ? Number(d).toFixed(1) : '—'
})
const workoutLabel = computed(() => {
  const t = props.activity?.workout_type
  if (!t || t === 'unknown') return 'RUN'
  const map = {
    tempo: 'TEMPO RUN',
    interval: 'INTERVALS',
    threshold: 'THRESHOLD',
    steady: 'STEADY RUN',
    easy: 'EASY RUN',
    recovery: 'RECOVERY',
    long: 'LONG RUN',
  }
  return map[t] || String(t).toUpperCase()
})
const intensityLabel = computed(() => {
  // derive from workout_type; fallback to pace+HR
  const t = props.activity?.workout_type
  const map = {
    recovery: 'Very Easy (RPE 3-4)',
    easy: 'Easy (RPE 4-5)',
    long: 'Easy (RPE 4-5)',
    steady: 'Moderate (RPE 6)',
    tempo: 'Moderate–Hard (RPE 7-8)',
    threshold: 'Hard (RPE 8-9)',
    interval: 'Very Hard (RPE 9-10)',
  }
  if (t && map[t]) return map[t]
  // fallback: show pace · HR
  return paceLabel.value + (props.activity?.avg_hr ? ` · ${props.activity.avg_hr} bpm` : '')
})
const dotClass = computed(() => {
  const t = props.activity?.workout_type
  if (['interval', 'threshold'].includes(t)) return 'bg-danger'
  if (t === 'tempo') return 'bg-primary'
  if (t === 'steady') return 'bg-warning'
  if (['easy', 'long', 'recovery'].includes(t)) return 'bg-success'
  return 'bg-success'
})
const trophyCount = computed(() => {
  const a = props.activity
  if (!a) return 0
  if (a.trophies?.length) return a.trophies.length
  if (a.achievement_count) return a.achievement_count
  return 0
})
</script>
