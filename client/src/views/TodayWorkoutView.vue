<template>
  <div class="max-w-2xl">
    <div class="text-primary text-xs tracking-widest font-semibold">TODAY'S WORKOUT</div>
    <div v-if="loading" class="mt-4 animate-pulse h-64 bg-card rounded-2xl"></div>
    <template v-else-if="data.isRest">
      <h1 class="text-white text-3xl font-bold mt-2 uppercase">REST</h1>
      <div class="text-white/60 mt-1">Recovery is training — no run scheduled today</div>
      <div class="mt-6 bg-card border border-white/10 rounded-2xl p-6 text-center">
        <div class="text-muted text-sm">Your weekly plan marks today as rest per preferred days. Check <RouterLink to="/plan" class="text-primary hover:underline">Training Plan</RouterLink> for the week.</div>
      </div>
    </template>
    <template v-else-if="data.recommendation">
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
      <div class="mt-6 bg-card border border-white/10 rounded-2xl p-5">
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
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api.js'
import { useToast } from '../composables/useToast.js'
import ChevronRightIcon from '../components/icons/ChevronRightIcon.vue'
const { show: showToast } = useToast()
const data = ref(null); const loading = ref(true)
const rpe = ref(null); const note = ref(''); const status = ref('completed'); const submitting = ref(false); const feedbackSaved = ref(false)
async function submitFeedback() {
  if (!rpe.value) { showToast('Pick an RPE 1–10', { type: 'warning' }); return }
  submitting.value = true
  try {
    await api.post('/plan/feedback', { date: new Date().toISOString().slice(0,10), rpe: rpe.value, note: note.value, status: status.value })
    feedbackSaved.value = true; showToast('Feedback saved — coach will adapt', { type: 'success' }); setTimeout(()=>feedbackSaved.value=false, 2000)
  } catch (e) { showToast(e.response?.data?.error || 'Save failed', { type: 'error' }) } finally { submitting.value = false }
}
onMounted(async () => { try { const { data: d } = await api.get('/plan/today'); data.value = d } catch {} finally { loading.value = false } })
</script>
