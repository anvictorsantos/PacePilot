<template>
  <div class="flex flex-col gap-2">
    <p class="font-bold text-xs uppercase tracking-widest text-muted">
      {{ $t('ui.all_performance_stats') }}
    </p>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-card border border-white/10 rounded-xl p-3 flex flex-col gap-1">
        <span class="font-bold text-caption uppercase tracking-wide text-muted">{{
          $t('ui.avg_pace')
        }}</span>
        <span class="font-extrabold text-lead leading-none text-white">{{ pace }}</span>
      </div>
      <div class="bg-card border border-white/10 rounded-xl p-3 flex flex-col gap-1">
        <span class="font-bold text-caption uppercase tracking-wide text-muted">{{
          $t('ui.avg_hr')
        }}</span>
        <span class="font-extrabold text-lead leading-none text-white">{{ hr }}</span>
      </div>
      <div class="bg-card border border-white/10 rounded-xl p-3 flex flex-col gap-1">
        <span class="font-bold text-caption uppercase tracking-wide text-muted">{{
          $t('ui.max_heart_rate')
        }}</span>
        <span class="font-extrabold text-lead leading-none text-white">{{ maxHr }}</span>
      </div>
      <div class="bg-card border border-white/10 rounded-xl p-3 flex flex-col gap-1">
        <span class="font-bold text-caption uppercase tracking-wide text-muted">{{
          $t('ui.elevation_gain')
        }}</span>
        <span class="font-extrabold text-lead leading-none text-white">{{ elev }}</span>
      </div>
      <div class="bg-card border border-white/10 rounded-xl p-3 flex flex-col gap-1">
        <span class="font-bold text-caption uppercase tracking-wide text-muted">{{
          $t('ui.cadence')
        }}</span>
        <span class="font-extrabold text-lead leading-none text-white">{{ cadence }}</span>
      </div>
      <div class="bg-card border border-white/10 rounded-xl p-3 flex flex-col gap-1">
        <span class="font-bold text-caption uppercase tracking-wide text-muted">{{
          $t('ui.calories_burnt')
        }}</span>
        <span class="font-extrabold text-lead leading-none text-white">{{ cals }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { paceFromActivity } from '@/utils/training-vocabulary.ts'

const props = defineProps({ activity: { type: Object, required: true } })
const pace = computed(() => paceFromActivity(props.activity))
const hr = computed(() =>
  props.activity?.avg_hr ? `${Math.round(props.activity.avg_hr)} bpm` : '—',
)
const maxHr = computed(() =>
  props.activity?.max_hr ? `${Math.round(props.activity.max_hr)} bpm` : '—',
)
const elev = computed(() =>
  props.activity?.elevation_m != null ? `+${Math.round(props.activity.elevation_m)} m` : '—',
)
const cadence = computed(() =>
  props.activity?.avg_cadence ? `${props.activity.avg_cadence} spm` : '—',
)
const cals = computed(() => {
  if (props.activity?.calories) return `${Math.round(props.activity.calories)} kcal`
  // estimate ~1 kcal per kg per km; assume 75kg
  const km =
    props.activity?.distance_km ??
    (props.activity?.distance_m != null ? props.activity.distance_m / 1000 : null)
  return km ? `${Math.round(km * 75)} kcal` : '—'
})
</script>
