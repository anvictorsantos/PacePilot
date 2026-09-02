<template>
  <div class="bg-card border border-white/10 rounded-2xl p-5">
    <div class="text-white font-semibold text-sm mb-1">Goal Progress</div>
    <div v-if="goal" class="text-muted text-xs mb-3">{{ goal.goal_type }} · {{ goal.target_time_min ? goal.target_time_min + ' min target' : 'no time target' }} · {{ goal.goal_date ? new Date(goal.goal_date).toLocaleDateString() : 'no date' }}</div>
    <div class="h-3 bg-white/10 rounded-full overflow-hidden">
      <div class="h-full bg-primary rounded-full transition-all" :style="{ width: pct + '%' }"></div>
    </div>
    <div class="text-muted text-xs mt-2">{{ pct }}% — {{ label }}</div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ goal: Object, pct: { type: Number, default: 62 }, label: { type: String, default: 'On track — keep the consistency' } })
</script>
