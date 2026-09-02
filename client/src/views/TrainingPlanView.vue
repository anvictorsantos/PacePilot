<template>
  <div>
    <h1 class="text-white text-2xl font-bold">Training Plan</h1>
    <p class="text-muted text-sm mt-1">Your adaptive 7-day plan — adjusts as new runs come in.</p>
    <div v-if="loading" class="mt-6 animate-pulse h-32 bg-card rounded-2xl"></div>
    <div v-else class="mt-6 grid grid-cols-2 md:grid-cols-7 gap-3">
      <div v-for="d in week" :key="d.date" class="rounded-2xl border p-4 text-center" :class="cardClass(d)">
        <div class="text-xs tracking-widest" :class="d.isToday ? 'text-primary font-bold' : 'text-muted'">{{ d.day }}</div>
        <div class="text-xs text-muted mt-0.5">{{ d.date.slice(5) }}</div>
        <div class="mt-3 text-sm font-bold" :class="d.workout.type === 'rest' ? 'text-muted' : 'text-white'">{{ d.workout.label }}</div>
        <div v-if="d.workout.distance" class="text-xs text-muted mt-1">{{ d.workout.distance }}</div>
        <div v-if="d.isToday" class="mt-2 text-[10px] bg-primary text-white px-2 py-0.5 rounded-full inline-block">TODAY</div>
      </div>
    </div>
    <div class="mt-6 flex gap-2 text-xs text-muted">
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-primary"></span> Today</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-white/20"></span> Planned</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-white/10"></span> Rest</span>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api.js'
const week = ref([]); const loading = ref(true)
onMounted(async () => { try { const { data } = await api.get('/plan/week'); week.value = data.week } catch {} finally { loading.value = false } })
function cardClass(d) {
  if (d.isToday) return 'bg-primary/10 border-primary/30'
  if (d.workout.type === 'rest') return 'bg-card border-white/5'
  return 'bg-card border-white/10'
}
</script>
