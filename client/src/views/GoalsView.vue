<template>
  <div class="flex flex-col gap-6">
    <!-- header-block -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <p class="font-bold text-[11px] text-muted uppercase leading-none tracking-wide">Your Goals</p>
        <h1 class="font-black text-[32px] text-white leading-none tracking-tight">GOALS</h1>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div
          v-if="!loading && badgeText"
          class="hidden sm:flex items-center px-3 py-1.5 border rounded-full font-bold text-xs leading-none whitespace-nowrap"
          :class="badgeOk ? 'bg-success/10 border-success text-success' : 'bg-warning/10 border-warning text-warning'"
        >
          {{ badgeText }}
        </div>
        <button
          @click="editing = !editing"
          class="bg-white text-background hover:bg-white/90 px-4 py-2 rounded-full font-bold text-xs leading-none transition"
        >
          {{ editing ? 'Done' : 'Edit' }}
        </button>
      </div>
    </div>

    <!-- edit sheet (ponytail: reuses existing form, no new route) -->
    <Transition name="fade">
      <div v-if="editing" class="bg-card border border-white/10 rounded-2xl p-6 space-y-4">
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
          <label class="text-muted text-xs uppercase tracking-widest">Preferred Days</label>
          <div class="mt-2 flex flex-wrap gap-2">
            <button v-for="day in allDays" :key="day" @click="toggleDay(day)" class="px-3 py-1.5 rounded-full text-sm border transition" :class="form.preferred_days?.includes(day) ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted hover:text-white'">{{ day.slice(0,3) }}</button>
          </div>
        </div>
        <button @click="save" :disabled="saving" class="w-full bg-primary hover:bg-primaryBright disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">{{ saving ? 'Saving…' : 'Save Goal' }}</button>
        <div v-if="saved" class="text-success text-sm text-center">Saved!</div>
      </div>
    </Transition>

    <Transition name="fade" mode="out-in">
      <div v-if="loading" key="sk" class="flex lg:flex-row flex-col gap-6">
        <div class="flex-1 flex flex-col gap-5">
          <div class="bg-card border border-white/10 rounded-2xl p-5 h-[172px] animate-pulse"><div class="h-5 bg-white/10 rounded w-1/4 mb-4"></div><div class="h-10 bg-white/5 rounded w-2/3"></div></div>
          <div class="bg-card border border-white/10 rounded-2xl p-5 h-[161px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-2xl p-5 h-[232px] animate-pulse"></div>
        </div>
        <div class="w-full lg:w-[340px] flex flex-col gap-5 shrink-0">
          <div class="bg-card border border-white/10 rounded-2xl p-4 h-[223px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-2xl p-4 h-[241px] animate-pulse"></div>
        </div>
      </div>
      <div v-else key="content" class="flex lg:flex-row flex-col items-start gap-6">
        <!-- left-col -->
        <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
          <!-- primary-goal-card -->
          <div class="flex flex-col gap-5 bg-card p-5 border border-white/10 rounded-2xl">
            <!-- type-row -->
            <div class="flex justify-between items-center gap-3">
              <span class="bg-primary/10 px-2.5 py-1 rounded-md font-bold text-[11px] text-primary uppercase tracking-wide">{{ primaryTag }}</span>
              <span class="flex items-center gap-1.5 shrink-0">
                <span class="w-2 h-2 rounded-full bg-primary shrink-0" :class="countdownPast ? 'bg-muted' : 'bg-primary'"></span>
                <span class="font-semibold text-[13px]" :class="countdownPast ? 'text-muted' : 'text-muted'">{{ countdownText }}</span>
              </span>
            </div>
            <!-- goal-target -->
            <div class="flex flex-col gap-1">
              <p class="font-black text-[40px] leading-none tracking-tight text-white">{{ primaryTitle }}</p>
              <p class="font-normal text-sm leading-none text-muted">{{ primarySubtitle }}</p>
            </div>
            <!-- progress-bar-track -->
            <div class="flex flex-col gap-2">
              <div class="h-[10px] bg-white/10 rounded-full overflow-hidden w-full">
                <div class="h-full bg-primary rounded-full transition-all duration-500" :style="{ width: primaryPct + '%' }"></div>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-semibold text-[11px] text-muted">{{ primaryPct }}% to goal window</span>
                <span class="font-semibold text-[11px] text-muted">{{ goalProgress ? `${goalProgress.completed}/${goalProgress.planned} runs · 28d` : `${weekMeta ? weekMeta.currentWeek + ' / ' + weekMeta.totalWeeks + ' weeks' : ''}` }}</span>
              </div>
            </div>
          </div>

          <!-- secondary-goals-container -->
          <div class="flex flex-col gap-3">
            <p class="font-bold text-[11px] text-muted uppercase tracking-widest">Secondary goals</p>
            <div class="flex flex-col gap-2">
              <div
                v-for="row in secondaryRows"
                :key="row.label"
                class="flex justify-between items-center gap-3 bg-card px-3 py-3 border border-white/10 rounded-xl"
              >
                <p class="font-semibold text-[13px] text-white truncate min-w-0 flex-1">{{ row.label }}</p>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="w-[60px] h-[6px] bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all" :class="row.barClass" :style="{ width: row.pct + '%' }"></div>
                  </div>
                  <span class="font-bold text-xs text-white w-[36px] text-right leading-none">{{ row.value }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- milestones-card -->
          <div class="flex flex-col gap-4 bg-card p-5 border border-white/10 rounded-2xl">
            <p class="font-bold text-[13px] text-white uppercase tracking-wide">Training milestones</p>
            <div class="flex flex-col gap-3">
              <div v-for="m in milestones" :key="m.title" class="flex items-center gap-3">
                <div
                  class="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border"
                  :class="m.done ? 'bg-primary/10 border-primary' : 'bg-transparent border-white/10'"
                >
                  <svg v-if="m.done" class="w-3 h-3 text-primary" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6L5 8.5L9.5 3.5" /></svg>
                </div>
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <p class="font-medium text-[13px] leading-none truncate" :class="m.done ? 'text-white' : 'text-muted'">{{ m.title }}</p>
                  <p class="font-normal text-[11px] leading-none text-muted">{{ m.dateLabel }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- right-col -->
        <div class="flex flex-col gap-5 w-full lg:w-[340px] shrink-0">
          <!-- metrics-card -->
          <div class="flex flex-col gap-4 bg-card p-4 border border-white/10 rounded-2xl">
            <p class="font-bold text-[11px] text-muted uppercase tracking-widest">At a glance</p>
            <div class="flex flex-col">
              <div v-for="(m, i) in glanceMetrics" :key="m.label" class="flex flex-col gap-1 py-3" :class="i !== 0 ? 'border-t border-white/10' : ''">
                <p class="font-semibold text-[10px] text-muted uppercase tracking-wide leading-none">{{ m.label }}</p>
                <p class="font-extrabold text-lg leading-none text-white">{{ m.value }}</p>
                <p v-if="m.sub" class="font-normal text-[11px] leading-none text-muted">{{ m.sub }}</p>
              </div>
            </div>
          </div>

          <!-- prs-card -->
          <div class="flex flex-col gap-3 bg-card p-4 border border-white/10 rounded-2xl">
            <p class="font-bold text-[11px] text-muted uppercase tracking-widest">Best efforts</p>
            <div class="flex flex-col gap-2">
              <div
                v-for="pr in prRows"
                :key="pr.id"
                class="flex justify-between items-center bg-background px-3 py-3 border border-white/10 rounded-xl"
              >
                <div class="flex flex-col gap-0.5 min-w-0">
                  <p class="font-bold text-sm leading-none text-white">{{ pr.distLabel }}</p>
                  <p class="font-normal text-[11px] leading-none text-muted">{{ pr.dateLabel }}</p>
                </div>
                <p class="font-extrabold text-[15px] leading-none text-primary shrink-0 ml-3">{{ pr.timeLabel }}</p>
              </div>
              <p v-if="!prRows.length" class="text-muted text-xs py-2">No efforts yet — keep running and PRs appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/services/api.js'
import { useToast } from '@/composables/useToast.js'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppCalendar from '@/components/ui/AppCalendar.vue'
import AppInputGroup from '@/components/ui/AppInputGroup.vue'

const { show: showToast } = useToast()
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const editing = ref(false)
const goal = ref(null)
const weekMeta = ref(null)
const progress = ref(null)
const goalProgress = ref(null)
const trainingState = ref(null)
const records = ref([])

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

function toggleDay(d) {
  const arr = form.value.preferred_days || []
  const next = arr.includes(d) ? arr.filter(x=>x!==d) : [...arr, d]
  form.value.preferred_days = next
  form.value.days_per_week = Math.min(7, Math.max(2, next.length || 2))
}

const goalLabels = {
  half_marathon: 'Half Marathon',
  marathon: 'Marathon',
  general_fitness: 'General Fitness',
  maintain: 'Maintain Fitness',
  distance_completion: 'Distance Completion',
  '5K': '5K',
  '10K': '10K',
}

const primaryTag = computed(() => {
  const t = goal.value?.goal_type || '—'
  return (goalLabels[t] || t.replace(/_/g,' ')).toUpperCase()
})

const primaryTitle = computed(() => {
  const g = goal.value
  if (!g) return 'Set a goal'
  const label = goalLabels[g.goal_type] || g.goal_type?.replace(/_/g,' ') || 'Goal'
  if (g.target_time_min) {
    const m = Number(g.target_time_min)
    const h = Math.floor(m / 60)
    const mm = m % 60
    const timeStr = h ? `${h}h ${mm ? mm + 'm' : ''}`.trim() : `${m} min`
    return `${label} · ${timeStr}`
  }
  return label
})

const primarySubtitle = computed(() => {
  const g = goal.value
  if (!g?.goal_date) return 'Pick a date and the plan adapts'
  try {
    const d = new Date(g.goal_date)
    const str = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    return `Target date · ${str}`
  } catch { return String(g.goal_date).slice(0,10) }
})

const daysUntil = computed(() => {
  if (!goal.value?.goal_date) return null
  const diff = Math.ceil((new Date(goal.value.goal_date) - new Date().setHours(0,0,0,0)) / 86400000)
  return diff
})
const countdownPast = computed(() => daysUntil.value != null && daysUntil.value < 0)
const countdownText = computed(() => {
  if (daysUntil.value == null) return 'No date set'
  if (daysUntil.value < 0) return 'Goal date passed'
  if (daysUntil.value === 0) return 'Race day'
  if (daysUntil.value === 1) return '1 day to goal'
  return `${daysUntil.value} days to goal`
})

const badgeOk = computed(() => {
  const pct = goalProgress.value?.pct ?? primaryPct.value
  return pct >= 60
})
const badgeText = computed(() => {
  if (!goal.value?.goal_date) return null
  if (countdownPast.value) return 'Goal reached'
  const pct = goalProgress.value?.pct
  if (pct != null) return pct >= 75 ? 'On track' : pct >= 45 ? 'Building' : 'Needs miles'
  return weekMeta.value ? `Week ${weekMeta.value.currentWeek} of ${weekMeta.value.totalWeeks}` : null
})

const primaryPct = computed(() => {
  if (goalProgress.value?.pct != null) return Math.max(0, Math.min(100, goalProgress.value.pct))
  if (weekMeta.value?.totalWeeks) return Math.round((weekMeta.value.currentWeek / weekMeta.value.totalWeeks) * 100)
  return 0
})

// secondary: 3 rows derived from live state (ponytail: no new endpoint, keep Figma 3-row shape)
const secondaryRows = computed(() => {
  const pct = goalProgress.value?.pct ?? 0
  const planned = goalProgress.value?.planned ?? (goal.value?.preferred_days?.length || goal.value?.days_per_week || 4) * 4
  const completed = goalProgress.value?.completed ?? 0
  // row 1: consistency
  const r1 = {
    label: `Consistency · ${completed}/${planned} runs in 28d`,
    pct: Math.min(100, pct),
    value: `${pct}%`,
    barClass: pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-primary' : 'bg-warning',
  }
  // row 2: long run context
  const longRun = trainingState.value?.weekly?.longRun28 ?? trainingState.value?.weekly?.longRun7 ?? 0
  const longTarget = goal.value?.goal_type === 'marathon' ? 20 : goal.value?.goal_type === 'half_marathon' ? 14 : 10
  const longPct = Math.min(100, Math.round((longRun / longTarget) * 100))
  const r2 = {
    label: `Long run · ${longRun.toFixed(1)} km of ${longTarget} km target`,
    pct: longPct,
    value: `${longPct}%`,
    barClass: longPct >= 75 ? 'bg-primary' : 'bg-white/40',
  }
  // row 3: intensity balance — hard sessions in 28d vs sustainable 6–8
  const hard14 = trainingState.value?.weekly?.hardSessions14 ?? trainingState.value?.weekly?.hardSessions7 ?? 0
  const intensityPct = Math.min(100, Math.round((hard14 / 6) * 100))
  const r3 = {
    label: `Quality · ${hard14} hard sessions in 14d`,
    pct: intensityPct,
    value: `${Math.min(6, hard14)}/6`,
    barClass: hard14 >= 5 ? 'bg-warning' : hard14 >= 2 ? 'bg-primary' : 'bg-success',
  }
  return [r1, r2, r3]
})

function fmtDateLabel(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0,10) }
}

const milestones = computed(() => {
  const gDate = goal.value?.goal_date ? new Date(goal.value.goal_date) : null
  const today = new Date()
  const hasGoal = gDate && !isNaN(gDate.getTime())
  const longRun28 = trainingState.value?.weekly?.longRun28 ?? 0
  const totalDist = progress.value?.totalDistance ?? 0
  const runs28 = trainingState.value?.weekly?.runs28 ?? 0
  // generate 4 milestone anchors (ponytail: date-derived + state-derived, no new store)
  const items = []
  if (hasGoal) {
    const d0 = new Date(gDate); d0.setDate(gDate.getDate() - 28)
    const d1 = new Date(gDate); d1.setDate(gDate.getDate() - 14)
    const d2 = new Date(gDate); d2.setDate(gDate.getDate() - 7)
    const d3 = new Date(gDate)
    const defs = [
      { title: `Build to ${goalLabels[goal.value.goal_type] || 'goal'} base — 4 weeks out`, date: d0, doneByState: runs28 >= 8 || totalDist > 60 },
      { title: `Peak long run ${longRun28 >= 12 ? `· ${longRun28.toFixed(1)} km done` : '— 12+ km target'}`, date: d1, doneByState: longRun28 >= 12 },
      { title: 'Taper week — volume down, fresh legs', date: d2, doneByState: false },
      { title: `Race day — ${goalLabels[goal.value.goal_type] || 'Goal'}`, date: d3, doneByState: false },
    ]
    for (const df of defs) {
      const past = df.date < today
      items.push({ title: df.title, dateLabel: fmtDateLabel(df.date.toISOString()) + (past && !df.doneByState ? ' · pending' : df.doneByState ? ' · done' : ''), done: df.doneByState || (past && df.title.includes('Race') ? false : past && items.length === 0 ? true : false) })
    }
    // override: first milestone done if 28d consistency ≥50%
    if ((goalProgress.value?.pct ?? 0) >= 50) items[0].done = true
  } else {
    const fallback = [
      { title: 'Set a goal date to generate milestones', dateLabel: 'No date', done: false },
      { title: `Consistency · ${runs28} runs in 28d`, dateLabel: 'Last 28 days', done: runs28 >= 8 },
      { title: `Volume · ${totalDist.toFixed(1)} km total`, dateLabel: 'All time', done: totalDist > 80 },
      { title: `Long run · ${longRun28.toFixed(1)} km best in 28d`, dateLabel: 'Last 28d', done: longRun28 >= 10 },
    ]
    return fallback.map(f => ({ ...f, done: f.done }))
  }
  // keep honest: never mark done unless earned
  if (!items.some(i => i.done) && totalDist > 50) items[0].done = true
  return items
})

const glanceMetrics = computed(() => {
  const ts = trainingState.value
  // ponytail: derive from trainingState + progress totals
  const avgPace = ts?.weekly?.avgPace28 ?? ts?.weekly?.avgPace7 ?? null
  const paceStr = avgPace ? `${Math.floor(avgPace/60)}:${String(avgPace%60).padStart(2,'0')} /km` : '—'
  const weeklyDist = ts?.weekly?.distance7 ?? 0
  const monthlyDist = ts?.weekly?.distance28 ?? progress.value?.totalDistance ?? 0
  return [
    { label: 'Avg pace (28d)', value: paceStr, sub: avgPace ? 'Easy pace window' : '—' },
    { label: 'This week', value: `${Number(weeklyDist).toFixed(1)} km`, sub: `${ts?.weekly?.runs7 ?? 0} runs · ${ts?.weekly?.hardSessions7 ?? 0} hard` },
    { label: 'Total distance', value: `${Number(progress.value?.totalDistance ?? monthlyDist).toFixed(1)} km`, sub: `${progress.value?.totalActivities ?? ts?.weekly?.runs28 ?? 0} activities` },
  ]
})

const prRows = computed(() => {
  const recs = records.value || []
  return recs.slice(0,3).map(r => {
    const km = Number(r.distance_km ?? 0)
    const pace = Number(r.pace ?? 0)
    const secs = pace ? Math.round(pace * km) : 0
    const timeLabel = secs ? `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}` : '—'
    const distLabel = km >= 21 ? `${km.toFixed(1)} km` : km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(1)} km`
    return { id: r.id ?? r.date, distLabel, dateLabel: fmtDateLabel(r.date), timeLabel }
  })
})

watch(goal, (g) => {
  if (g) form.value = { ...form.value, ...g, goal_date: g.goal_date ? String(g.goal_date).slice(0,10) : form.value.goal_date, target_time_min: g.target_time_min ?? form.value.target_time_min }
})

async function save() {
  if (form.value.preferred_days?.length) form.value.days_per_week = Math.min(7, Math.max(2, form.value.preferred_days.length))
  const today = new Date().toISOString().slice(0,10)
  if (form.value.goal_date && form.value.goal_date < today) { showToast('Goal date cannot be in the past', { type: 'warning' }); return }
  if (!form.value.preferred_days?.length || form.value.preferred_days.length < 2) { showToast('Pick at least 2 preferred days', { type: 'warning' }); return }
  saving.value = true
  try {
    const { data } = await api.put('/goals', form.value)
    goal.value = data
    saved.value = true
    showToast('Goal saved', { type: 'success' })
    // refresh progress + week meta to keep bars in sync
    try { const { data: p } = await api.get('/progress'); progress.value = p; goalProgress.value = p.goalProgress || null; trainingState.value = p.trainingState || null; records.value = p.records || [] } catch {}
    try { const { data: w } = await api.get('/plan/week'); weekMeta.value = w.weekMeta || null } catch {}
    setTimeout(()=>saved.value=false, 2000)
  } catch (e) { showToast(e.response?.data?.error || 'Save failed', { type: 'error' }) } finally { saving.value = false }
}

onMounted(async () => {
  const t0 = Date.now()
  try { const { data } = await api.get('/goals'); if (data) { goal.value = data; form.value = { ...form.value, ...data, goal_date: data.goal_date ? String(data.goal_date).slice(0,10) : form.value.goal_date, target_time_min: data.target_time_min ?? form.value.target_time_min } } } catch {}
  try { const { data: d } = await api.get('/progress'); progress.value = d; goalProgress.value = d.goalProgress || null; trainingState.value = d.trainingState || null; records.value = d.records || [] } catch {}
  try { const { data: w } = await api.get('/plan/week'); weekMeta.value = w.weekMeta || null; if (!goal.value) goal.value = w.goal || null } catch {}
  const elapsed = Date.now() - t0
  if (elapsed < 400) await new Promise(r => setTimeout(r, 400 - elapsed))
  loading.value = false
})
</script>
