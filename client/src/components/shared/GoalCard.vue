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
