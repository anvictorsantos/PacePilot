<template>
  <div
    class="flex flex-col items-start p-4.5 gap-3.5 self-stretch w-full rounded-2xl border border-white/10 bg-card"
  >
    <div class="flex flex-row justify-between items-center self-stretch h-[33px]">
      <div class="flex flex-col items-start gap-[2px] min-w-0 flex-1">
        <p class="font-bold text-caption leading-caption text-primary uppercase tracking-widest">
          {{ $t('ui.target_training_status') }}
        </p>
        <p class="truncate font-extrabold text-base leading-[19px] text-white">{{ goalLabel }}</p>
      </div>
      <p class="font-black text-xl leading-6 text-primary text-right shrink-0">{{ pct }}%</p>
    </div>
    <ProgressBar
      :pct="pct"
      :label="$t('ui.target_training_status')"
      size="md"
      :rounded="false"
    />
    <div class="flex flex-row justify-between items-start self-stretch">
      <p class="font-normal text-xs leading-[15px] text-muted">{{ weeksText }}</p>
      <p class="font-semibold text-xs leading-[15px] text-muted text-right">{{ daysLeft }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ProgressBar from '@/components/ui/ProgressBar.vue'

const props = defineProps({
  goal: { type: Object, default: null },
  weekMeta: { type: Object, default: null },
})
const pct = computed(() => {
  if (!props.weekMeta?.totalWeeks) return 0
  return Math.round((props.weekMeta.currentWeek / props.weekMeta.totalWeeks) * 100)
})
const goalLabel = computed(() => {
  const map = {
    half_marathon: 'Half Marathon Completion',
    marathon: 'Marathon Completion',
    '5K': '5K Completion',
    '10K': '10K Completion',
    general_fitness: 'General Fitness',
    maintain: 'Maintain Fitness',
  }
  const t = props.goal?.goal_type || '—'
  if (map[t]) return map[t]
  return t === '—'
    ? '—'
    : t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' Completion'
})
const daysLeft = computed(() => {
  if (!props.goal?.goal_date) return '—'
  const diff = Math.ceil((new Date(props.goal.goal_date) - new Date()) / 86400000)
  return diff >= 0 ? `${diff} days left` : 'Goal reached'
})
const weeksText = computed(() => {
  if (!props.weekMeta) return '—'
  return `${props.weekMeta.currentWeek} of ${props.weekMeta.totalWeeks} weeks complete`
})
</script>
