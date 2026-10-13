<template>
  <div class="max-w-2xl">
    <div class="text-primary text-xs tracking-widest font-semibold">TODAY'S WORKOUT</div>
    <Transition name="fade" mode="out-in">
      <Skeleton v-if="loading" key="skeleton" class="mt-6" />
      <div v-else key="content" class="mt-6">
        <div>
      <template v-if="todayCompleted">
        <h1 class="text-success text-3xl font-bold mt-2 uppercase">WELL DONE, TRAIN COMPLETED!</h1>
        <p class="text-white/60 text-sm mt-1">You trained today — great work. Recovery starts now.</p>
        <ActivityCard v-if="todayActivity" :activity="todayActivity" class="mt-6" />
        <div v-else class="mt-6 bg-card border border-white/10 rounded-2xl p-5 text-sm text-muted">No Strava activity found for today yet. It may still be syncing — check <RouterLink to="/activities" class="text-primary hover:underline">Activities</RouterLink>.</div>
        <div v-if="nextWorkout" class="mt-6 bg-card border border-white/10 rounded-2xl p-5">
          <div class="text-muted text-xs tracking-widest font-semibold">NEXT TRAIN IS:</div>
          <div class="text-white text-xl font-bold mt-1 uppercase">{{ nextWorkout.type }}</div>
          <div v-if="nextWorkout.date" class="text-white/60 text-sm mt-1">{{ nextWorkout.date }} · {{ nextWorkout.distance || '' }} {{ nextWorkout.label ? '· ' + nextWorkout.label : '' }}</div>
          <RouterLink to="/plan" class="mt-4 inline-flex items-center justify-center w-full sm:w-auto px-6 font-semibold py-2.5 text-sm rounded-xl transition bg-white/10 hover:bg-white/15 text-white">View Week</RouterLink>
        </div>
        <RouterLink v-else to="/activities" class="mt-6 inline-flex text-primary text-sm hover:underline">View today's activity →</RouterLink>
        <div v-if="!feedbackSaved" class="mt-6 bg-card border border-white/10 rounded-2xl p-5">
          <div class="text-muted text-xs uppercase tracking-widest">How did it go?</div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <button v-for="n in 10" :key="n" @click="rpe=n" class="w-8 h-8 rounded-full text-sm font-semibold border transition" :class="rpe===n ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted hover:text-white'">{{ n }}</button>
            <span class="ml-2 text-muted text-xs self-center">RPE 1 easy → 10 max</span>
          </div>
          <div class="mt-3 flex gap-2">
            <button @click="status='completed'" class="px-3 py-1.5 rounded-full text-xs border" :class="status==='completed' ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted'">Completed</button>
            <button @click="status='skipped'" class="px-3 py-1.5 rounded-full text-xs border" :class="status==='skipped' ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted'">Skipped</button>
          </div>
          <input v-model="note" placeholder="One-line note (optional)" class="mt-3 w-full bg-cardSecondary border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50" />
          <button @click="submitFeedback" :disabled="submitting || !rpe" class="mt-3 w-full bg-primary hover:bg-primaryBright disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm">{{ submitting ? 'Saving…' : 'Save feedback' }}</button>
        </div>
      </template>
      <template v-else-if="data?.recommendation">
        <h1 class="text-white text-3xl font-bold mt-2 uppercase">{{ data.recommendation.type }}</h1>
        <div class="text-white/60 mt-1">{{ data.recommendation.distance_km }} KM · {{ data.recommendation.duration_min }} min · {{ data.recommendation.intensity }}</div>
        <div class="mt-6 bg-card border border-white/10 rounded-2xl p-6 space-y-5">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div><div class="text-muted text-xs uppercase tracking-widest">Target Pace</div><div class="text-white font-semibold mt-1">{{ data.recommendation.target_pace }}</div></div>
            <div><div class="text-muted text-xs uppercase tracking-widest">Target HR</div><div class="text-white font-semibold mt-1">{{ data.recommendation.target_hr }}</div></div>
          </div>
          <div>
            <div class="text-muted text-xs uppercase tracking-widest">Warm Up</div>
            <div class="text-white text-sm mt-1">{{ data.recommendation.warmup }}</div>
          </div>
          <div>
            <div class="text-muted text-xs uppercase tracking-widest">Main Set</div>
            <div class="text-white text-sm mt-1">{{ data.recommendation.main_set }}</div>
          </div>
          <div>
            <div class="text-muted text-xs uppercase tracking-widest">Cool Down</div>
            <div class="text-white text-sm mt-1">{{ data.recommendation.cooldown }}</div>
          </div>
          <div class="pt-4 border-t border-white/10">
            <div class="text-muted text-xs uppercase tracking-widest">Why This Workout?</div>
            <p class="text-white text-sm mt-2">{{ data.recommendation.purpose }}</p>
            <ul class="mt-3 space-y-1">
              <li v-for="(r,i) in data.reasons" :key="i" class="text-muted text-sm flex gap-2 items-start"><ChevronRightIcon cls="w-4 h-4 shrink-0 mt-0.5 text-primary" /> {{ r }}</li>
            </ul>
          </div>
          <div class="bg-primary/10 border border-primary/20 rounded-xl p-4">
            <div class="text-primary text-xs font-semibold">If legs feel unusually heavy</div>
            <div class="text-white text-sm mt-1">{{ data.recommendation.alternative }}</div>
          </div>
        </div>
        <!-- Feedback — feeds adaptive loop (RPE 1–10 + note) -->
        <div v-if="!feedbackSaved" class="mt-6 bg-card border border-white/10 rounded-2xl p-5">
          <div class="text-muted text-xs uppercase tracking-widest">How did it go?</div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <button v-for="n in 10" :key="n" @click="rpe=n" class="w-8 h-8 rounded-full text-sm font-semibold border transition" :class="rpe===n ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted hover:text-white'">{{ n }}</button>
            <span class="ml-2 text-muted text-xs self-center">RPE 1 easy → 10 max</span>
          </div>
          <div class="mt-3 flex gap-2">
            <button @click="status='completed'" class="px-3 py-1.5 rounded-full text-xs border" :class="status==='completed' ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted'">Completed</button>
            <button @click="status='skipped'" class="px-3 py-1.5 rounded-full text-xs border" :class="status==='skipped' ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted'">Skipped</button>
          </div>
          <input v-model="note" placeholder="One-line note (optional)" class="mt-3 w-full bg-cardSecondary border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50" />
          <button @click="submitFeedback" :disabled="submitting || !rpe" class="mt-3 w-full bg-primary hover:bg-primaryBright disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm">{{ submitting ? 'Saving…' : feedbackSaved ? 'Saved!' : 'Save feedback' }}</button>
        </div>
      </template>
      <div v-else class="text-muted mt-4">No workout available.</div>
      </div>
      </div>
    </Transition>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api.js'
import { useToast } from '@/composables/useToast.js'
import ChevronRightIcon from '@/components/icons/ChevronRightIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ActivityCard from '@/components/ui/ActivityCard.vue'
const { show: showToast } = useToast()
const data = ref(null); const loading = ref(true)
const rpe = ref(null); const note = ref(''); const status = ref('completed'); const submitting = ref(false); const feedbackSaved = ref(false)
const todayKey = new Date().toISOString().slice(0,10)
try { if (localStorage.getItem(`feedback:${todayKey}`)) feedbackSaved.value = true } catch {}
const todayCompleted = ref(false); const nextWorkout = ref(null); const todayActivity = ref(null)
// sync fast-path: demoMode stores feedback locally — set before first paint so we never flash TODAY'S WORKOUT
try {
  const v = localStorage.getItem(`feedback:${todayKey}`)
  const s = localStorage.getItem(`feedback:${todayKey}:status`)
  if (v && (!s || s === 'completed')) todayCompleted.value = true
} catch {}
function todayKeyStr() { return new Date().toISOString().slice(0,10) }
async function checkCompletedAndNext() {
  const today = todayKeyStr()
  let isCompleted = false
  try {
    const { data: fb } = await api.get('/plan/feedback')
    if (Array.isArray(fb) && fb.some(f => String(f.date||'').slice(0,10) === today && f.status === 'completed')) isCompleted = true
  } catch {}
  if (!isCompleted) {
    try {
      const { data } = await api.get('/activities', { params: { perPage: 10 } })
      const items = data.items || data || []
      const hit = items.find(a => String(a.date||a.start_date||'').slice(0,10) === today)
      if (hit) { isCompleted = true; todayActivity.value = hit }
    } catch {}
  }
  if (!isCompleted) {
    try {
      const v = localStorage.getItem(`feedback:${today}`)
      const st = localStorage.getItem(`feedback:${today}:status`)
      if (v && (!st || st === 'completed')) isCompleted = true
    } catch {}
  }
  // load today's activity for display whenever completed (even if via feedback/localStorage)
  if (isCompleted && !todayActivity.value) {
    try {
      const { data } = await api.get('/activities', { params: { perPage: 10 } })
      const items = data.items || data || []
      todayActivity.value = items.find(a => String(a.date||a.start_date||'').slice(0,10) === today) || null
    } catch {}
  }
  todayCompleted.value = isCompleted
  if (!isCompleted) return
  try {
    const { data: w } = await api.get('/plan/week')
    const week = w.week || []
    const idx = week.findIndex(d => d.date === today)
    for (let i = idx + 1; i < week.length; i++) {
      if (week[i].workout.type !== 'rest') { nextWorkout.value = { ...week[i].workout, date: week[i].date }; return }
    }
    const future = week.find(d => d.date > today && d.workout.type !== 'rest')
    if (future) nextWorkout.value = { ...future.workout, date: future.date }
  } catch {}
}
async function submitFeedback() {
  if (!rpe.value) { showToast('Pick an RPE 1–10', { type: 'warning' }); return }
  submitting.value = true
  const date = new Date().toISOString().slice(0,10)
  try {
    await api.post('/plan/feedback', { date, rpe: rpe.value, note: note.value, status: status.value })
    try { localStorage.setItem(`feedback:${date}`, '1'); localStorage.setItem(`feedback:${date}:status`, status.value) } catch {}
    feedbackSaved.value = true; showToast('Feedback saved — coach will adapt', { type: 'success' })
    if (status.value === 'completed') { todayCompleted.value = true; await checkCompletedAndNext() }
  } catch (e) { showToast(e.response?.data?.error || 'Save failed', { type: 'error' }) } finally { submitting.value = false }
}
onMounted(async () => {
  try {
    const { data: fb } = await api.get('/plan/feedback')
    if (Array.isArray(fb) && fb.some(f => String(f.date || '').slice(0,10) === todayKey)) feedbackSaved.value = true
  } catch {}
  try { const { data: d } = await api.get('/plan/today'); data.value = d } catch {}
  await checkCompletedAndNext()
  loading.value = false
})
</script>
