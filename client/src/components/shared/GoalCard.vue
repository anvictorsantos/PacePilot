<template>
  <div class="bg-card p-4.5 border border-white/10 rounded-xl w-full">
    <h4 class="mb-3.5 font-medium text-body text-primary">{{ $t('ui.target_training_status') }}</h4>
    <p class="text-lead text-primary leading-snug">{{ goalLabel }}</p>
    <p class="mt-0.5 mb-3.5 font-mono text-label text-muted">{{ weeksText }}</p>
    <div
      class="bg-[#26262e] rounded-sm h-1.5 overflow-hidden"
      role="progressbar"
      :aria-valuenow="pct"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <i
        class="block bg-primary rounded-sm h-full"
        :style="{ width: `${pct}%` }"
      ></i>
    </div>
    <div class="flex justify-between mt-2 font-mono text-caption text-faint">
      <span>{{ pct }}%</span>
      <span>{{ daysLeft }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Goal } from '@/modules/goals/infrastructure/dto/Goal.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { goalCompletionLabel } from '@/modules/shared/ui/training-vocabulary.ts'
import type { WeekMetaPrimitives } from '@/modules/training/domain/value-object/WeekMeta.ts'

const { t } = useI18n()
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
  const diff = LocalDateKey.today().diffDays(LocalDateKey.from(props.goal.goal_date))
  if (Number.isNaN(diff)) return '—'
  return diff >= 0 ? t('goals.display.daysTo', { n: diff }) : t('goals.display.reached')
})
const weeksText = computed(() => {
  const current = props.weekMeta?.currentWeek
  const total = props.weekMeta?.totalWeeks
  if (current == null || total == null) return '—'
  return t('goals.display.weeksComplete', { current, total })
})
</script>
