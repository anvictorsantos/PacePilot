<template>
  <div class="max-w-2xl">
    <h1 class="text-white text-2xl font-bold">Goals</h1>
    <p class="text-muted text-sm mt-1">Define your target — the plan adapts to it.</p>
    <Transition name="fade" mode="out-in">
      <Skeleton v-if="loading" key="skeleton" class="mt-6" />
      <div v-else key="form" class="mt-6 bg-card border border-white/10 rounded-2xl p-6 space-y-5">
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
        <label class="text-muted text-xs uppercase tracking-widest">Runs Per Week <span class="normal-case tracking-normal text-white/30">(auto from selected days)</span></label>
        <AppInputGroup v-model="form.days_per_week" type="number" :min="2" :max="7" trailing-addon="runs / week" number class="mt-1" />
      </div>
      <div>
        <label class="text-muted text-xs uppercase tracking-widest">Preferred Days</label>
        <div class="mt-2 flex flex-wrap gap-2">
          <button v-for="day in allDays" :key="day" @click="toggleDay(day)" class="px-3 py-1.5 rounded-full text-sm border transition" :class="form.preferred_days?.includes(day) ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted hover:text-white'">{{ day.slice(0,3) }}</button>
        </div>
      </div>
      <GoalProgress :goal="form" :pct="goalProgress?.pct ?? null" :label="goalProgress ? `${goalProgress.completed}/${goalProgress.planned} runs in last 28 days` : 'Update and keep training — progress reflects consistency'" />
      <button @click="save" :disabled="saving" class="w-full bg-primary hover:bg-primaryBright disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">{{ saving ? 'Saving…' : 'Save Goal' }}</button>
      <div v-if="saved" class="text-success text-sm text-center">Saved!</div>
    </div>
    </Transition>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api.js'
import { useToast } from '@/composables/useToast.js'
import GoalProgress from '@/components/coach/GoalProgress.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppCalendar from '@/components/ui/AppCalendar.vue'
import AppInputGroup from '@/components/ui/AppInputGroup.vue'
const { show: showToast } = useToast()
const loading = ref(true); const saving = ref(false); const saved = ref(false)
const goalProgress = ref(null)
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
const form = ref({ goal_type: null, target_time_min: null, goal_date: null, days_per_week: null, preferred_days: [] })
onMounted(async () => {
  const t0 = Date.now()
  try { const { data } = await api.get('/goals'); if (data) form.value = { ...form.value, ...data, goal_date: data.goal_date ? data.goal_date.slice(0,10) : form.value.goal_date, target_time_min: data.target_time_min ?? form.value.target_time_min } } catch {}
  try { const { data } = await api.get('/progress'); goalProgress.value = data.goalProgress || null } catch {}
  const elapsed = Date.now() - t0
  if (elapsed < 400) await new Promise(r => setTimeout(r, 400 - elapsed))
  loading.value = false
})
function toggleDay(d) {
  const arr = form.value.preferred_days || []
  const next = arr.includes(d) ? arr.filter(x=>x!==d) : [...arr, d]
  form.value.preferred_days = next
  form.value.days_per_week = Math.min(7, Math.max(2, next.length || 2))
}
async function save() {
  // Derive days_per_week from selected days to prevent contradiction
  if (form.value.preferred_days?.length) form.value.days_per_week = Math.min(7, Math.max(2, form.value.preferred_days.length))
  // Past-date guard
  const today = new Date().toISOString().slice(0,10)
  if (form.value.goal_date && form.value.goal_date < today) { showToast('Goal date cannot be in the past', { type: 'warning' }); return }
  // Need at least 2 days
  if (!form.value.preferred_days?.length || form.value.preferred_days.length < 2) { showToast('Pick at least 2 preferred days', { type: 'warning' }); return }
  saving.value = true
  try { await api.put('/goals', form.value); saved.value = true; showToast('Goal saved', { type: 'success' }); setTimeout(()=>saved.value=false, 2000) } catch (e) { showToast(e.response?.data?.error || 'Save failed', { type: 'error' }) } finally { saving.value = false }
}
</script>
