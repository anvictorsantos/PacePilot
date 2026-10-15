import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/composables/useToast.js'
import { getActivities } from '@/services/activities.js'
import { getPlanFeedback, getPlanToday, getPlanWeek, submitPlanFeedback } from '@/services/plan.js'
import { getProgress } from '@/services/progress.js'
import { localDateKey as localKey, toLocalDateKey as toLocalStr } from '@/utils/dates.js'
import { formatPace } from '@/utils/format.js'
import { WORKOUT_TYPE_NAMES, INTENSITY_LABELS } from '@/utils/labels.js'

export function useTodayWorkout() {

const { t } = useI18n()
const { show: showToast } = useToast()
const data = ref(null)
const loading = ref(true)
const weekMeta = ref(null)
const week = ref([])
const goal = ref(null)
const volumeSeries = ref([])
const trainingState = ref(null)
const rpe = ref(null)
const note = ref('')
const status = ref('completed')
const submitting = ref(false)
const feedbackSaved = ref(false)
// local keys come from @/utils/dates.js (never UTC toISOString)
const todayKey = localKey()
// hydrate form from saved feedback so locked view shows real values
function hydrateFromLocal() {
  try {
    const raw = localStorage.getItem(`feedback:${todayKey}:data`)
    if (raw) {
      const j = JSON.parse(raw)
      if (j.rpe != null) rpe.value = j.rpe
      if (j.note != null) note.value = j.note
      if (j.status) status.value = j.status
    }
  } catch {}
}
hydrateFromLocal()
try {
  if (localStorage.getItem(`feedback:${todayKey}`)) feedbackSaved.value = true
} catch {}
const todayCompleted = ref(false)
const nextWorkout = ref(null)
const todayActivity = ref(null)
try {
  const v = localStorage.getItem(`feedback:${todayKey}`)
  const s = localStorage.getItem(`feedback:${todayKey}:status`)
  if (v && (!s || s === 'completed')) todayCompleted.value = true
} catch {}

const headerDate = computed(() => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})
const headerDateShort = computed(() => {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' Session'
})
const isRest = computed(() => {
  const t = data.value?.recommendation?.type || data.value?.workout?.type || ''
  return t === 'rest' || data.value?.isRest
})
const workoutTypeLabel = computed(() => {
  const t = data.value?.recommendation?.type || data.value?.workout?.type || 'workout'
  if (t === 'rest') return 'REST'
  return WORKOUT_TYPE_NAMES[t] || t.toUpperCase()
})
const intensityLabel = computed(() => {
  const t = data.value?.recommendation?.type || data.value?.workout?.type || ''
  return INTENSITY_LABELS[t] || data.value?.recommendation?.intensity || '—'
})
const intensityDotClass = computed(() => {
  const t = data.value?.recommendation?.type || ''
  if (['interval', 'threshold'].includes(t)) return 'bg-danger'
  if (t === 'tempo') return 'bg-primary'
  if (t === 'steady') return 'bg-warning'
  if (['easy', 'long', 'recovery'].includes(t)) return 'bg-success'
  return 'bg-muted'
})
const displayDistance = computed(() => {
  const d = data.value?.recommendation?.distance_km
  return d != null ? Number(d).toFixed(1) : '—'
})
const displayDuration = computed(() => data.value?.recommendation?.duration_min ?? '—')
const displayPace = computed(() => data.value?.recommendation?.target_pace || '—')
const warmupText = computed(() => data.value?.recommendation?.warmup || '—')
const mainSub = computed(() =>
  data.value?.recommendation?.target_pace
    ? `${data.value.recommendation.target_pace} pace`
    : data.value?.recommendation?.main_set || '',
)
const cooldownText = computed(() => data.value?.recommendation?.cooldown || '—')
const warmupSub = computed(() => 'Easy pace')
const cooldownSub = computed(() => 'Easy pace')
const mainLabel = computed(() => {
  const t = data.value?.recommendation?.type || ''
  if (t === 'tempo') return 'Tempo block'
  if (t === 'interval') return 'Intervals'
  if (t === 'threshold') return 'Threshold'
  if (t === 'steady') return 'Steady block'
  if (t === 'long') return 'Long run'
  if (t === 'easy') return 'Main set'
  return 'Main block'
})
const totalKm = computed(() => Number(data.value?.recommendation?.distance_km) || 0)
const warmupDist = computed(() => {
  const tot = totalKm.value
  if (!tot) return '—'
  const w = tot <= 5 ? 1.0 : 1.5
  return `${w.toFixed(1)} km`
})
const mainDist = computed(() => {
  const tot = totalKm.value
  if (!tot) return '—'
  const w = tot <= 5 ? 1.0 : 1.5
  const c = w
  const m = Math.max(0.5, tot - w - c)
  return `${m.toFixed(1)} km`
})
const cooldownDist = computed(() => {
  const tot = totalKm.value
  if (!tot) return '—'
  const c = tot <= 5 ? 1.0 : 1.5
  return `${c.toFixed(1)} km`
})
const coachingText = computed(() =>
  data.value?.recommendation?.purpose || data.value?.training_state
    ? 'Stay consistent — each session builds on the last.'
    : '',
)
const adaptedReason = computed(
  () => data.value?.adapted?.reason || data.value?.workout?.reason || null,
)

// insights — exact Figma 9:561: 4 cards (Weekly Distance / Hard Sessions / Avg Pace / Consistency)
const insightCards = computed(() => {
  const ts = trainingState.value
  const vs = volumeSeries.value || []
  // live path: use last non-zero weekly volume (current week may still be in-progress = 0)
  let lastIdx = vs.length - 1
  while (lastIdx >= 0 && (vs[lastIdx]?.distance ?? 0) === 0) lastIdx--
  if (lastIdx < 0) lastIdx = vs.length - 1
  const last =
    lastIdx >= 0
      ? (vs[lastIdx]?.distance ?? ts?.weekly?.distance7 ?? 0)
      : (ts?.weekly?.distance7 ?? 0)
  let prev = 0
  for (let i = lastIdx - 1; i >= 0; i--)
    if ((vs[i]?.distance ?? 0) > 0) {
      prev = vs[i].distance
      break
    }
  if (!prev && vs.length >= 2) prev = vs[Math.max(0, lastIdx - 1)]?.distance ?? 0
  let deltaSub = '—'
  let deltaTone = 'muted'
  if (prev > 0) {
    const pct = Math.round(((last - prev) / prev) * 100)
    if (pct > 0) {
      deltaSub = `+${pct}% vs last week`
      deltaTone = 'success'
    } else if (pct < 0) {
      deltaSub = `${pct}% vs last week`
      deltaTone = 'muted'
    } else {
      deltaSub = 'On track'
      deltaTone = 'muted'
    }
  } else if (last > 0) {
    deltaSub = 'First week'
    deltaTone = 'success'
  }

  const hard = ts?.weekly?.hardSessions7 ?? 0
  const paceSec = ts?.weekly?.avgPace7 ?? ts?.weekly?.avgPace28 ?? null
  const paceStr = paceSec ? formatPace(paceSec) : '—'
  const plannedPerWeek = goal.value?.preferred_days?.length || 5
  const runs28 = ts?.weekly?.runs28 ?? 0
  const planned28 = plannedPerWeek * 4
  const consistencyPct = planned28 ? Math.round(Math.min(100, (runs28 / planned28) * 100)) : 0
  const consistencySub = runs28
    ? consistencyPct >= 80
      ? 'On track'
      : consistencyPct >= 60
        ? 'Building'
        : 'Needs attention'
    : '—'

  return [
    {
      label: 'Weekly Distance',
      value: `${Number(last).toFixed(1)} km`,
      sub: deltaSub,
      tone: deltaTone,
    },
    {
      label: 'Hard Sessions',
      value: `${hard} / wk`,
      sub: hard >= 3 ? 'High load' : hard === 0 ? 'Recovery' : 'On Track',
      tone: hard >= 3 ? 'success' : 'muted',
    },
    {
      label: 'Avg Pace',
      value: paceStr,
      sub: paceSec ? 'Optimal' : '—',
      tone: 'muted',
    },
    {
      label: 'Consistency',
      value: consistencyPct ? `${consistencyPct}%` : '—',
      sub: consistencySub,
      tone: consistencyPct >= 80 ? 'success' : 'muted',
    },
  ]
})

const volumeActiveIndex = computed(() => {
  // highlight current week (last bar) — matches live rolling window
  if (!volumeSeries.value?.length) return -1
  return volumeSeries.value.length - 1
})

async function checkCompletedAndNext() {
  const today = localKey()
  let isCompleted = false
  // single activities fetch shared by both checks (was 2 sequential calls)
  let activityItems = null
  async function getActivityItems() {
    if (!activityItems) {
      try {
        const data = await getActivities({ perPage: 10 })
        activityItems = data.items || data || []
      } catch {
        activityItems = []
      }
    }
    return activityItems
  }
  try {
    const fb = await getPlanFeedback()
    if (
      Array.isArray(fb) &&
      fb.some((f) => toLocalStr(f.date) === today && f.status === 'completed')
    )
      isCompleted = true
  } catch {}
  if (!isCompleted) {
    const items = await getActivityItems()
    const hit = items.find((a) => toLocalStr(a.date || a.start_date) === today)
    if (hit) {
      isCompleted = true
      todayActivity.value = hit
    }
  }
  if (!isCompleted) {
    try {
      const v = localStorage.getItem(`feedback:${today}`)
      const st = localStorage.getItem(`feedback:${today}:status`)
      if (v && (!st || st === 'completed')) isCompleted = true
    } catch {}
  }
  if (isCompleted && !todayActivity.value) {
    const items = await getActivityItems()
    todayActivity.value = items.find((a) => toLocalStr(a.date || a.start_date) === today) || null
  }
  todayCompleted.value = isCompleted
  if (!isCompleted) return
  try {
    const w = await getPlanWeek()
    const wk = w.week || []
    const idx = wk.findIndex((d) => d.date === today)
    for (let i = idx + 1; i < wk.length; i++)
      if (wk[i].workout.type !== 'rest') {
        nextWorkout.value = { ...wk[i].workout, date: wk[i].date }
        return
      }
    const future = wk.find((d) => d.date > today && d.workout.type !== 'rest')
    if (future) nextWorkout.value = { ...future.workout, date: future.date }
  } catch {}
}
async function submitFeedback() {
  if (feedbackSaved.value) return
  if (!rpe.value && status.value !== 'skipped') {
    showToast(t('landing.sections.today.validation.rpeRequired'), { type: 'warning' })
    return
  }
  submitting.value = true
  const date = localKey()
  try {
    await submitPlanFeedback({
      date,
      rpe: rpe.value,
      note: note.value,
      status: status.value,
    })
    try {
      localStorage.setItem(`feedback:${date}`, '1')
      localStorage.setItem(`feedback:${date}:status`, status.value)
      localStorage.setItem(
        `feedback:${date}:data`,
        JSON.stringify({
          rpe: rpe.value,
          note: note.value,
          status: status.value,
        }),
      )
    } catch {}
    feedbackSaved.value = true
    showToast(t('landing.sections.today.toast.feedbackSaved'), { type: 'success' })
    if (status.value === 'completed') {
      todayCompleted.value = true
      await checkCompletedAndNext()
    }
  } catch (e) {
    showToast(e.response?.data?.error || t('landing.sections.today.toast.saveFailed'), {
      type: 'error',
    })
  } finally {
    submitting.value = false
  }
}
onMounted(async () => {
  // one parallel batch — was 4 sequential serverless round trips
  const [fbRes, todayRes, weekRes, progRes] = await Promise.allSettled([
    getPlanFeedback(),
    getPlanToday(),
    getPlanWeek(),
    getProgress(),
  ])
  try {
    const fb = fbRes.status === 'fulfilled' ? fbRes.value : null
    if (Array.isArray(fb)) {
      const hit = fb.find((f) => toLocalStr(f.date) === todayKey)
      if (hit) {
        feedbackSaved.value = true
        if (hit.rpe != null) rpe.value = hit.rpe
        if (hit.notes != null) note.value = hit.notes
        else if (hit.note != null) note.value = hit.note
        if (hit.status) status.value = hit.status
        try {
          localStorage.setItem(
            `feedback:${todayKey}:data`,
            JSON.stringify({
              rpe: hit.rpe ?? rpe.value,
              note: note.value,
              status: hit.status ?? status.value,
            }),
          )
        } catch {}
      }
    }
  } catch {}
  try {
    if (todayRes.status === 'fulfilled') data.value = todayRes.value
  } catch {}
  try {
    if (weekRes.status === 'fulfilled') {
      const w = weekRes.value
      week.value = w.week || []
      weekMeta.value = w.weekMeta || null
      goal.value = w.goal || null
    }
  } catch {}
  try {
    if (progRes.status === 'fulfilled') {
      const p = progRes.value
      volumeSeries.value = p.volumeSeries || []
      trainingState.value = p.trainingState || null
      if (!goal.value && p.goalProgress) goal.value = p.goalProgress
    }
  } catch {}
  await checkCompletedAndNext()
  loading.value = false
})

  return {
    adaptedReason,
    coachingText,
    cooldownDist,
    cooldownSub,
    cooldownText,
    data,
    displayDistance,
    displayDuration,
    displayPace,
    feedbackSaved,
    goal,
    headerDate,
    headerDateShort,
    hydrateFromLocal,
    insightCards,
    intensityDotClass,
    intensityLabel,
    isRest,
    loading,
    mainDist,
    mainLabel,
    mainSub,
    nextWorkout,
    note,
    rpe,
    status,
    submitFeedback,
    submitting,
    todayActivity,
    todayCompleted,
    totalKm,
    trainingState,
    volumeActiveIndex,
    volumeSeries,
    warmupDist,
    warmupSub,
    warmupText,
    week,
    weekMeta,
    workoutTypeLabel
  }
}
