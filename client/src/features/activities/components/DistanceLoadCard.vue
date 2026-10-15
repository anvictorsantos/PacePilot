<template>
  <div class="bg-card border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <span class="font-bold text-xs uppercase tracking-widest text-muted">{{
        $t('ui.workout_distance')
      }}</span>
      <span
        class="font-bold text-sm"
        :class="typeColor"
        >{{ typeLabel }}</span
      >
    </div>
    <p class="font-black text-5xl leading-none text-white">{{ distLabel }}</p>
    <div class="flex justify-between items-start">
      <div class="flex flex-col gap-0.5">
        <span class="font-normal text-xs text-muted">{{ $t('ui.total_time') }}</span>
        <span class="font-extrabold text-lg leading-none text-white">{{ timeLabel }}</span>
      </div>
      <div class="flex flex-col gap-0.5 items-end">
        <span class="font-normal text-xs text-muted">{{ $t('ui.training_load') }}</span>
        <span class="font-extrabold text-lg leading-none text-primary">{{ loadLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ activity: { type: Object, required: true } })

const typeLabel = computed(() => {
  const t = props.activity?.workout_type
  if (!t || t === 'unknown') return 'EASY PACED'
  const map = {
    easy: 'EASY PACED',
    recovery: 'RECOVERY',
    long: 'LONG RUN',
    tempo: 'TEMPO',
    threshold: 'THRESHOLD',
    interval: 'INTERVAL',
    steady: 'STEADY',
  }
  return (map[t] || String(t)).toUpperCase()
})
const typeColor = computed(() => {
  const t = props.activity?.workout_type
  return ['easy', 'recovery', 'long'].includes(t) ? 'text-blue-500' : 'text-primary'
})
const distLabel = computed(() => {
  const km =
    props.activity?.distance_km ??
    (props.activity?.distance_m != null ? props.activity.distance_m / 1000 : null)
  return km != null ? `${Number(km).toFixed(1)} km` : '—'
})
const timeLabel = computed(() => {
  const s =
    props.activity?.moving_time_s ??
    (props.activity?.moving_time_min != null
      ? Math.round(props.activity.moving_time_min * 60)
      : null)
  if (s == null) return '—'
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
})
const loadLabel = computed(() => {
  // ponytail: naive TRIMP proxy; real load needs HR zones
  const mins =
    props.activity?.moving_time_min ??
    (props.activity?.moving_time_s != null ? props.activity.moving_time_s / 60 : 30)
  const hr = props.activity?.avg_hr ?? 145
  const load = Math.round(mins * (hr / 150) * 1.1)
  const tag = load < 35 ? 'Low' : load > 60 ? 'High' : 'Optimal'
  return `${load} (${tag})`
})
</script>
