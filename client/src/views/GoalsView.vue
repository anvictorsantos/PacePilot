<template>
  <div class="max-w-2xl">
    <h1 class="text-white text-2xl font-bold">Goals</h1>
    <p class="text-muted text-sm mt-1">Define your target — the plan adapts to it.</p>
    <div v-if="loading" class="mt-6 animate-pulse h-64 bg-card rounded-2xl"></div>
    <div v-else class="mt-6 bg-card border border-white/10 rounded-2xl p-6 space-y-5">
      <div>
        <label class="text-muted text-xs uppercase tracking-widest">Goal Type</label>
        <AppSelect v-model="form.goal_type" :options="goalTypeOptions" id="goal-type" class="mt-1" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-muted text-xs uppercase tracking-widest">Target Time</label>
          <AppInputGroup v-model="form.target_time_min" type="number" placeholder="e.g. 50" trailing-addon="min" number class="mt-1" />
        </div>
        <div><label class="text-muted text-xs uppercase tracking-widest">Goal Date</label><AppCalendar v-model="form.goal_date" id="goal-date" class="mt-1" /></div>
      </div>
      <div>
        <label class="text-muted text-xs uppercase tracking-widest">Runs Per Week</label>
        <AppInputGroup v-model="form.days_per_week" type="number" :min="2" :max="7" trailing-addon="runs / week" number class="mt-1" />
      </div>
      <div>
        <label class="text-muted text-xs uppercase tracking-widest">Preferred Days</label>
        <div class="mt-2 flex flex-wrap gap-2">
          <button v-for="day in allDays" :key="day" @click="toggleDay(day)" class="px-3 py-1.5 rounded-full text-sm border transition" :class="form.preferred_days?.includes(day) ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted hover:text-white'">{{ day.slice(0,3) }}</button>
        </div>
      </div>
      <GoalProgress :goal="form" :pct="62" label="Update and keep training — progress reflects consistency" />
      <button @click="save" :disabled="saving" class="w-full bg-primary hover:bg-primaryBright disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">{{ saving ? 'Saving…' : 'Save Goal' }}</button>
      <div v-if="saved" class="text-success text-sm text-center">Saved!</div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api.js'
import GoalProgress from '../components/coach/GoalProgress.vue'
import AppSelect from '../components/ui/AppSelect.vue'
import AppCalendar from '../components/ui/AppCalendar.vue'
import AppInputGroup from '../components/ui/AppInputGroup.vue'
const loading = ref(true); const saving = ref(false); const saved = ref(false)
const goalTypeOptions = [
  { value: 'general_fitness', label: 'General Fitness' },
  { value: '5K', label: '5K' },
  { value: '10K', label: '10K' },
  { value: 'half_marathon', label: 'Half Marathon' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'distance_completion', label: 'Distance Completion' },
  { value: 'maintain', label: 'Maintain Fitness' },
]
const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const form = ref({ goal_type: '10K', target_time_min: 50, goal_date: '2026-11-15', days_per_week: 4, preferred_days: ['Tuesday','Thursday','Saturday','Sunday'] })
onMounted(async () => { try { const { data } = await api.get('/goals'); if (data) form.value = { ...form.value, ...data, goal_date: data.goal_date ? data.goal_date.slice(0,10) : form.value.goal_date } } catch {} finally { loading.value = false } })
function toggleDay(d) { const arr = form.value.preferred_days || []; form.value.preferred_days = arr.includes(d) ? arr.filter(x=>x!==d) : [...arr, d] }
async function save() { saving.value = true; try { await api.put('/goals', form.value); saved.value = true; setTimeout(()=>saved.value=false, 2000) } catch {} finally { saving.value = false } }
</script>
