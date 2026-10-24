<template>
  <div
    class="flex flex-col items-start self-stretch gap-3.5 bg-card p-4.5 border border-white/10 rounded-2xl w-full"
  >
    <div class="flex flex-row justify-between items-center self-stretch h-[33px]">
      <div class="flex flex-col flex-1 items-start gap-[2px] min-w-0">
        <p class="font-bold text-caption text-primary uppercase leading-caption tracking-widest">
          {{ $t('ui.target_training_status') }}
        </p>
        <p class="font-extrabold text-white text-base truncate leading-[19px]">{{ goalLabel }}</p>
      </div>
      <p class="font-black text-primary text-xl text-right leading-6 shrink-0">{{ pct }}%</p>
    </div>
    <ProgressBar
      :pct="pct"
      :label="$t('ui.target_training_status')"
      size="md"
      :rounded="false"
    />
    <div class="flex flex-row justify-between items-start self-stretch">
      <p class="font-normal text-muted text-xs leading-[15px]">{{ weeksText }}</p>
      <p class="font-semibold text-muted text-xs text-right leading-[15px]">{{ daysLeft }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

import ProgressBar from '@/components/ui/ProgressBar.vue'
import type { Goal } from '@/modules/goals/infrastructure/dto/Goal.ts'
import { goalCompletionLabel } from '@/modules/shared/ui/training-vocabulary.ts'
import type { WeekMetaPrimitives } from '@/modules/training/domain/value-object/WeekMeta.ts'

const props = defineProps({
  goal: { type: Object as PropType<Goal | null | undefined>, default: null },
  weekMeta: { type: Object as PropType<WeekMetaPrimitives | null | undefined>, default: null },
})
const pct = computed(() => {
  const total = props.weekMeta?.totalWeeks
  const current = props.weekMeta?.currentWeek
  if (!total || current == null) return 0
  return Math.round((current / total) * 100)
})
const goalLabel = computed(() => goalCompletionLabel(props.goal?.goal_type))
const daysLeft = computed(() => {
  if (!props.goal?.goal_date) return '—'
  const diff = Math.ceil((new Date(props.goal.goal_date).getTime() - Date.now()) / 86400000)
  return diff >= 0 ? `${diff} days left` : 'Goal reached'
})
const weeksText = computed(() => {
  const current = props.weekMeta?.currentWeek
  const total = props.weekMeta?.totalWeeks
  if (current == null || total == null) return '—'
  return `${current} of ${total} weeks complete`
})
</script>
