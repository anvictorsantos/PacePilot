<template>
  <Skeleton v-if="loading" />
  <div v-else class="bg-card border border-white/10 rounded-2xl p-5">
    <div class="text-white font-semibold text-sm mb-1">Goal Progress</div>
    <div v-if="goal" class="text-muted text-xs mb-3">{{ goalLabel }} · {{ goal.target_time_min ? goal.target_time_min + ' min target' : 'no time target' }} · {{ goal.goal_date ? new Date(goal.goal_date).toLocaleDateString() : 'no date' }}</div>
    <div v-if="pct == null" class="text-muted text-xs">Not enough runs yet — complete a week to see consistency</div>
    <template v-else>
      <div class="h-3 bg-white/10 rounded-full overflow-hidden">
        <div class="h-full bg-primary rounded-full transition-all" :style="{ width: pct + '%' }"></div>
      </div>
      <div class="text-muted text-xs mt-2">{{ pct }}% — {{ label }}</div>
    </template>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import Skeleton from '@/components/ui/Skeleton.vue'
const props = defineProps({ goal: Object, pct: { type: Number, default: null }, label: { type: String, default: 'On track — keep the consistency' }, loading: Boolean })
const goalTypeMap = { general_fitness: 'General Fitness', '5K': '5K', '10K': '10K', half_marathon: 'Half Marathon', marathon: 'Marathon', distance_completion: 'Distance Completion', maintain: 'Maintain Fitness' }
const goalLabel = computed(() => goalTypeMap[props.goal?.goal_type] || props.goal?.goal_type || '—')
</script>
