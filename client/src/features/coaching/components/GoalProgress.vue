<template>
  <Skeleton v-if="loading" />
  <div
    v-else
    class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5"
  >
    <div class="flex items-center justify-between">
      <p class="text-label font-bold uppercase tracking-widest text-muted">{{ title }}</p>
      <span
        v-if="pct != null"
        class="rounded bg-primary/10 px-2 py-0.5 text-label font-bold text-primary"
        >{{ pct }}%</span
      >
    </div>
    <div
      v-if="goal"
      class="text-label font-normal text-muted"
    >
      {{ goalLabel }} ·
      {{ goal.target_time_min ? goal.target_time_min + ' min target' : 'no time target' }} ·
      {{ goal.goal_date ? new Date(goal.goal_date).toLocaleDateString() : 'no date' }}
    </div>
    <div
      v-if="pct == null"
      class="text-sm text-muted"
    >
      {{ $t('ui.not_enough_runs') }}
    </div>
    <template v-else>
      <div
        v-if="completed != null && planned != null"
        class="flex items-baseline gap-2"
      >
        <p class="text-title font-black leading-none text-white">
          {{ completed }}<span class="text-sm font-bold text-muted">/{{ planned }}</span>
        </p>
        <p class="text-label font-normal text-muted">{{ subtitle }}</p>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          class="h-full rounded-full bg-primary transition-all"
          :class="`w-[${pct}%]`"
        ></div>
      </div>
      <p class="text-label font-normal text-muted">{{ label }}</p>
    </template>
  </div>
</template>
<script setup>
import { computed } from 'vue'

import Skeleton from '@/components/ui/Skeleton.vue'
const props = defineProps({
  goal: { type: Object, default: null },
  pct: { type: Number, default: null },
  label: { type: String, default: 'On track — keep the consistency' },
  loading: { type: Boolean, default: false },
  title: { type: String, default: 'Goal Progress' },
  subtitle: { type: String, default: 'runs completed' },
  completed: { type: Number, default: null },
  planned: { type: Number, default: null },
})
const goalTypeMap = {
  general_fitness: 'General Fitness',
  '5K': '5K',
  '10K': '10K',
  half_marathon: 'Half Marathon',
  marathon: 'Marathon',
  distance_completion: 'Distance Completion',
  maintain: 'Maintain Fitness',
}
const goalLabel = computed(() => goalTypeMap[props.goal?.goal_type] || props.goal?.goal_type || '—')
</script>
