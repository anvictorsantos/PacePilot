<template>
  <Skeleton v-if="loading || checking" />
  <div v-else class="bg-card border border-white/10 rounded-2xl p-6">
    <div :class="['text-xs tracking-widest font-semibold mb-2', labelClass]">{{ label }}</div>
    <div v-if="showNextLabel" class="text-muted text-sm mb-1">Next train is:</div>
    <div class="text-white text-2xl font-bold">{{ title }}</div>
    <div v-if="subtitle" class="text-white/60 text-sm mt-1">{{ subtitle }}</div>
    <p v-if="description" class="text-muted text-sm mt-3">{{ description }}</p>
    <RouterLink :to="ctaTo" :class="ctaClass" class="mt-5 inline-flex items-center justify-center w-full sm:w-auto px-6 font-semibold py-2.5 sm:py-3 text-sm sm:text-[15px] rounded-xl transition">{{ ctaText }}</RouterLink>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/services/api.js'
import Skeleton from '@/components/ui/Skeleton.vue'

const props = defineProps({ workout: Object, loading: Boolean })

const completed = ref(false)
const checking = ref(true)
const nextWorkout = ref(null)

// sync fast-path before first paint — prevents TODAY'S WORKOUT flash then WELL DONE
try {
  const k = new Date().toISOString().slice(0,10)
  const v = localStorage.getItem(`feedback:${k}`)
  const s = localStorage.getItem(`feedback:${k}:status`)
  if (v && (!s || s === 'completed')) completed.value = true
} catch {}

const isRest = computed(() => !completed.value && !!props.workout?.isRest)

const label = computed(() => completed.value ? 'WELL DONE, TRAIN COMPLETED!' : "TODAY'S WORKOUT")
const labelClass = computed(() => completed.value ? 'text-success' : 'text-primary')
const showNextLabel = computed(() => completed.value)
const title = computed(() => {
  if (completed.value) return (nextWorkout.value?.type || props.workout?.recommendation?.type || '—').toUpperCase()
  if (isRest.value) return 'REST'
  return props.workout?.recommendation?.type?.toUpperCase() || '—'
})
const subtitle = computed(() => {
  if (completed.value) {
    if (nextWorkout.value) return `${nextWorkout.value.distance}${nextWorkout.value.date ? ` · ${nextWorkout.value.date.slice(5)}` : ''}`
    if (props.workout?.recommendation) return `${props.workout.recommendation.distance_km} km · ${props.workout.recommendation.intensity}`
    return ''
  }
  if (isRest.value) return 'Recovery is training — no run scheduled today'
  if (props.workout?.recommendation) return `${props.workout.recommendation.distance_km} km · ${props.workout.recommendation.intensity}`
  return ''
})
const description = computed(() => {
  if (completed.value) return nextWorkout.value?.type && nextWorkout.value.type !== 'rest' ? 'Get ready for your next session' : ''
  if (isRest.value) return ''
  return props.workout?.recommendation?.purpose || ''
})
const ctaTo = computed(() => completed.value || isRest.value ? '/plan' : '/workout')
const ctaText = computed(() => completed.value || isRest.value ? 'View Week' : 'View Workout')
const ctaClass = computed(() => completed.value || isRest.value ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-primary hover:bg-primaryBright text-white')

function todayKey() { return new Date().toISOString().slice(0,10) }

async function checkCompleted() {
  const today = todayKey()
  // 1) localStorage fallback (demo mode)
  try { if (localStorage.getItem(`feedback:${today}`)) { const raw = localStorage.getItem(`feedback:${today}:status`); if (!raw || raw === 'completed') { /* assume completed if feedback exists and not skipped */ } } } catch {}
  // 2) server feedback
  try {
    const { data } = await api.get('/plan/feedback')
    const hit = Array.isArray(data) && data.find(f => String(f.date||'').slice(0,10) === today && f.status === 'completed')
    if (hit) { completed.value = true; return }
    // also consider skipped as not completed — keep false
  } catch {}
  // 3) today's Strava activity (if you ran, it's completed regardless of feedback)
  try {
    const { data } = await api.get('/activities', { params: { perPage: 10 } })
    const items = data.items || data || []
    const todayAct = items.find(a => String(a.date||a.start_date||'').slice(0,10) === today)
    if (todayAct) { completed.value = true; return }
  } catch {}
  // 4) localStorage check for completed status
  try {
    if (localStorage.getItem(`feedback:${today}`)) {
      // if feedback exists, check if we stored a completed vs skipped — default to completed for backward compat
      const status = localStorage.getItem(`feedback:${today}:status`)
      if (!status || status === 'completed') completed.value = true
    }
  } catch {}
}

async function fetchNext() {
  if (!completed.value) return
  try {
    const { data } = await api.get('/plan/week')
    const week = data.week || []
    const today = todayKey()
    const idx = week.findIndex(d => d.date === today)
    // next scheduled (non-rest) after today
    for (let i = idx + 1; i < week.length; i++) {
      if (week[i].workout.type !== 'rest') { nextWorkout.value = { ...week[i].workout, date: week[i].date }; return }
    }
    // fallback: first future non-rest if today not found
    const future = week.find(d => d.date > today && d.workout.type !== 'rest')
    if (future) nextWorkout.value = { ...future.workout, date: future.date }
  } catch {}
}

onMounted(async () => { await checkCompleted(); if (completed.value) await fetchNext(); checking.value = false })
watch(() => props.workout, async () => { if (completed.value && !nextWorkout.value) await fetchNext() })
</script>
