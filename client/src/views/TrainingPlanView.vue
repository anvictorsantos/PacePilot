<template>
  <div>
    <h1 class="text-white text-2xl font-bold">Training Plan</h1>
    <p class="text-muted text-sm mt-1">Your adaptive 7-day plan — adjusts as new runs come in.</p>
    <div v-if="todayCompleted && nextWorkout" class="mt-4 bg-success/10 border border-success/20 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <div class="text-success text-xs tracking-widest font-semibold">WELL DONE, TRAIN COMPLETED!</div>
        <div class="text-white text-sm mt-1">Next train is: <span class="font-bold">{{ nextWorkout.type.toUpperCase() }}</span> · {{ nextWorkout.distance }}<span v-if="nextWorkout.date"> · {{ nextWorkout.date.slice(5) }}</span></div>
      </div>
      <RouterLink to="/workout" class="shrink-0 text-success text-sm hover:underline">View →</RouterLink>
    </div>
    <Skeleton v-if="loading" class="mt-6" />
    <div v-else class="mt-6 grid grid-cols-2 md:grid-cols-7 gap-3">
      <div v-for="d in week" :key="d.date" class="rounded-2xl border p-4 text-center transition" :class="cardClass(d)">
        <div class="text-xs tracking-widest" :class="isNext(d) ? 'text-success font-bold' : d.isToday ? (todayCompleted ? 'text-muted' : 'text-primary font-bold') : 'text-muted'">{{ d.day }}</div>
        <div class="text-xs text-muted mt-0.5">{{ d.date.slice(5) }}</div>
        <div class="mt-3 text-sm font-bold" :class="d.workout.type === 'rest' ? 'text-muted' : isNext(d) ? 'text-success' : 'text-white'">{{ d.workout.label }}</div>
        <div v-if="d.workout.distance" class="text-xs text-muted mt-1">{{ d.workout.distance }}</div>
        <div v-if="d.workout.status === 'adapted'" class="mt-1 text-[10px] text-primary leading-tight">{{ d.workout.reason }}</div>
        <div v-if="d.isToday" class="mt-2 text-[10px] px-2 py-0.5 rounded-full inline-block" :class="todayCompleted ? 'bg-success/20 text-success' : 'bg-primary text-white'">{{ todayCompleted ? 'DONE' : 'TODAY' }}</div>
        <div v-else-if="isNext(d)" class="mt-2 text-[10px] bg-success text-white px-2 py-0.5 rounded-full inline-block">NEXT</div>
      </div>
    </div>
    <div class="mt-6 flex gap-2 text-xs text-muted">
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-primary"></span> Today</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success"></span> Next</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-white/20"></span> Planned</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-white/10"></span> Rest</span>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api.js'
import Skeleton from '@/components/ui/Skeleton.vue'
const week = ref([]); const loading = ref(true)
const todayCompleted = ref(false); const nextWorkout = ref(null)
function todayKey() { return new Date().toISOString().slice(0,10) }
function isNext(d) { return nextWorkout.value && d.date === nextWorkout.value.date }
async function checkCompletedAndNext() {
  const today = todayKey()
  let isCompleted = false
  try {
    const { data } = await api.get('/plan/feedback')
    if (Array.isArray(data) && data.some(f => String(f.date||'').slice(0,10) === today && f.status === 'completed')) isCompleted = true
  } catch {}
  if (!isCompleted) {
    try {
      const { data } = await api.get('/activities', { params: { perPage: 10 } })
      const items = data.items || data || []
      if (items.some(a => String(a.date||a.start_date||'').slice(0,10) === today)) isCompleted = true
    } catch {}
  }
  if (!isCompleted) {
    try {
      const v = localStorage.getItem(`feedback:${today}`)
      const st = localStorage.getItem(`feedback:${today}:status`)
      if (v && (!st || st === 'completed')) isCompleted = true
    } catch {}
  }
  todayCompleted.value = isCompleted
  if (!isCompleted) return
  const w = week.value
  const idx = w.findIndex(d => d.date === today)
  for (let i = idx + 1; i < w.length; i++) {
    if (w[i].workout.type !== 'rest') { nextWorkout.value = { ...w[i].workout, date: w[i].date }; return }
  }
  const future = w.find(d => d.date > today && d.workout.type !== 'rest')
  if (future) nextWorkout.value = { ...future.workout, date: future.date }
}
onMounted(async () => {
  try { const { data } = await api.get('/plan/week'); week.value = data.week } catch {} finally { loading.value = false }
  await checkCompletedAndNext()
})
function cardClass(d) {
  if (isNext(d)) return 'bg-success/10 border-success/30'
  if (d.isToday) return todayCompleted.value ? 'bg-card border-white/5 opacity-60' : 'bg-primary/10 border-primary/30'
  if (d.workout.type === 'rest') return 'bg-card border-white/5'
  return 'bg-card border-white/10'
}
</script>
