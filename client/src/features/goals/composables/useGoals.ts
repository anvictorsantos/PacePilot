import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/composables/useToast.ts'
import { api, apiErrorMessage } from '@/services/client.ts'
import { recordRecoveredError } from '@/services/logger.ts'
import type { Goal, ProgressResponse } from '@/types/domain.ts'
import { formatDuration } from '@/utils/format.ts'
import { GOAL_OPTIONS, goalLabel, paceFromSec } from '@/utils/training-vocabulary.ts'

export function useGoals() {
  const { t, locale } = useI18n()
  const { show: showToast } = useToast()
  const loading = ref<boolean>(true)
  const saving = ref<boolean>(false)
  const saved = ref<boolean>(false)
  const editing = ref<boolean>(false)
  const goal = ref<Goal | null>(null)
  const weekMeta = ref<{ currentWeek?: number | null; totalWeeks?: number | null } | null>(null)
  const progress = ref<ProgressResponse | null>(null)
  const goalProgress = ref<{
    pct?: number | null
    completed?: number | null
    planned?: number | null
  } | null>(null)
  const trainingState = ref<ProgressResponse['trainingState']>(null)
  const records = ref<ProgressResponse['records']>([])

  const goalTypeOptions = GOAL_OPTIONS
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const form = ref<{
    goal_type: string | null
    target_time_min: number | null
    goal_date: string | null
    days_per_week: number | null
    preferred_days: string[]
  }>({
    goal_type: null,
    target_time_min: null,
    goal_date: null,
    days_per_week: null,
    preferred_days: [],
  })

  function toggleDay(d) {
    const arr = form.value.preferred_days || []
    const next = arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]
    form.value.preferred_days = next
    form.value.days_per_week = Math.min(7, Math.max(2, next.length || 2))
  }

  const primaryTag = computed(() => goalLabel(goal.value?.goal_type).toUpperCase())

  const primaryTitle = computed(() => {
    const g = goal.value
    if (!g) return 'Set a goal'
    const label = goalLabel(g.goal_type)
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
      const str = d.toLocaleDateString(locale.value, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      return `Target date · ${str}`
    } catch {
      return String(g.goal_date).slice(0, 10)
    }
  })

  const daysUntil = computed(() => {
    if (!goal.value?.goal_date) return null
    const diff = Math.ceil(
      (new Date(goal.value.goal_date) - new Date().setHours(0, 0, 0, 0)) / 86400000,
    )
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
    return weekMeta.value
      ? `Week ${weekMeta.value.currentWeek} of ${weekMeta.value.totalWeeks}`
      : null
  })

  const primaryPct = computed(() => {
    if (goalProgress.value?.pct != null) return Math.max(0, Math.min(100, goalProgress.value.pct))
    if (weekMeta.value?.totalWeeks)
      return Math.round((weekMeta.value.currentWeek / weekMeta.value.totalWeeks) * 100)
    return 0
  })

  // secondary: 3 rows derived from live state (ponytail: no new endpoint, keep Figma 3-row shape)
  const secondaryRows = computed(() => {
    const pct = goalProgress.value?.pct ?? 0
    const planned =
      goalProgress.value?.planned ??
      (goal.value?.preferred_days?.length || goal.value?.days_per_week || 4) * 4
    const completed = goalProgress.value?.completed ?? 0
    // row 1: consistency
    const r1 = {
      label: `Consistency · ${completed}/${planned} runs in 28d`,
      pct: Math.min(100, pct),
      value: `${pct}%`,
      barClass: pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-primary' : 'bg-warning',
    }
    // row 2: long run context
    const longRun =
      trainingState.value?.weekly?.longRun28 ?? trainingState.value?.weekly?.longRun7 ?? 0
    const longTarget =
      goal.value?.goal_type === 'marathon'
        ? 20
        : goal.value?.goal_type === 'half_marathon'
          ? 14
          : 10
    const longPct = Math.min(100, Math.round((longRun / longTarget) * 100))
    const r2 = {
      label: `Long run · ${longRun.toFixed(1)} km of ${longTarget} km target`,
      pct: longPct,
      value: `${longPct}%`,
      barClass: longPct >= 75 ? 'bg-primary' : 'bg-white/40',
    }
    // row 3: intensity balance — hard sessions in 28d vs sustainable 6–8
    const hard14 =
      trainingState.value?.weekly?.hardSessions14 ?? trainingState.value?.weekly?.hardSessions7 ?? 0
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
    try {
      return new Date(iso).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
    } catch {
      return String(iso).slice(0, 10)
    }
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
      const d0 = new Date(gDate)
      d0.setDate(gDate.getDate() - 28)
      const d1 = new Date(gDate)
      d1.setDate(gDate.getDate() - 14)
      const d2 = new Date(gDate)
      d2.setDate(gDate.getDate() - 7)
      const d3 = new Date(gDate)
      const defs = [
        {
          title: `Build to ${goalLabel(goal.value.goal_type)} base — 4 weeks out`,
          date: d0,
          doneByState: runs28 >= 8 || totalDist > 60,
        },
        {
          title: `Peak long run ${longRun28 >= 12 ? `· ${longRun28.toFixed(1)} km done` : '— 12+ km target'}`,
          date: d1,
          doneByState: longRun28 >= 12,
        },
        { title: 'Taper week — volume down, fresh legs', date: d2, doneByState: false },
        {
          title: `Race day — ${goalLabel(goal.value.goal_type)}`,
          date: d3,
          doneByState: false,
        },
      ]
      for (const df of defs) {
        const past = df.date < today
        items.push({
          title: df.title,
          dateLabel:
            fmtDateLabel(df.date.toISOString()) +
            (past && !df.doneByState ? ' · pending' : df.doneByState ? ' · done' : ''),
          done:
            df.doneByState ||
            (past && df.title.includes('Race') ? false : past && items.length === 0 ? true : false),
        })
      }
      // override: first milestone done if 28d consistency ≥50%
      if ((goalProgress.value?.pct ?? 0) >= 50) items[0].done = true
    } else {
      const fallback = [
        { title: 'Set a goal date to generate milestones', dateLabel: 'No date', done: false },
        {
          title: `Consistency · ${runs28} runs in 28d`,
          dateLabel: 'Last 28 days',
          done: runs28 >= 8,
        },
        {
          title: `Volume · ${totalDist.toFixed(1)} km total`,
          dateLabel: 'All time',
          done: totalDist > 80,
        },
        {
          title: `Long run · ${longRun28.toFixed(1)} km best in 28d`,
          dateLabel: 'Last 28d',
          done: longRun28 >= 10,
        },
      ]
      return fallback.map((f) => ({ ...f, done: f.done }))
    }
    // keep honest: never mark done unless earned
    if (!items.some((i) => i.done) && totalDist > 50) items[0].done = true
    return items
  })

  const glanceMetrics = computed(() => {
    const ts = trainingState.value
    // ponytail: derive from trainingState + progress totals
    const avgPace = ts?.weekly?.avgPace28 ?? ts?.weekly?.avgPace7 ?? null
    const paceStr = avgPace ? paceFromSec(avgPace) : '—'
    const weeklyDist = ts?.weekly?.distance7 ?? 0
    const monthlyDist = ts?.weekly?.distance28 ?? progress.value?.totalDistance ?? 0
    return [
      { label: 'Avg pace (28d)', value: paceStr, sub: avgPace ? 'Easy pace window' : '—' },
      {
        label: 'This week',
        value: `${Number(weeklyDist).toFixed(1)} km`,
        sub: `${ts?.weekly?.runs7 ?? 0} runs · ${ts?.weekly?.hardSessions7 ?? 0} hard`,
      },
      {
        label: 'Total distance',
        value: `${Number(progress.value?.totalDistance ?? monthlyDist).toFixed(1)} km`,
        sub: `${progress.value?.totalActivities ?? ts?.weekly?.runs28 ?? 0} activities`,
      },
    ]
  })

  const prRows = computed(() => {
    const recs = records.value || []
    return recs.slice(0, 3).map((r) => {
      const km = Number(r.distance_km ?? 0)
      const pace = Number(r.pace ?? 0)
      const secs = pace ? Math.round(pace * km) : 0
      const timeLabel = secs ? formatDuration(secs) : '—'
      const distLabel =
        km >= 21 ? `${km.toFixed(1)} km` : km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(1)} km`
      return { id: r.id ?? r.date, distLabel, dateLabel: fmtDateLabel(r.date), timeLabel }
    })
  })

  watch(goal, (g) => {
    if (g)
      form.value = {
        ...form.value,
        ...g,
        goal_date: g.goal_date ? String(g.goal_date).slice(0, 10) : form.value.goal_date,
        target_time_min: g.target_time_min ?? form.value.target_time_min,
      }
  })

  async function save() {
    if (form.value.preferred_days?.length)
      form.value.days_per_week = Math.min(7, Math.max(2, form.value.preferred_days.length))
    const today = new Date().toISOString().slice(0, 10)
    if (form.value.goal_date && form.value.goal_date < today) {
      showToast(t('goals.form.validation.pastDate'), { type: 'warning' })
      return
    }
    if (!form.value.preferred_days?.length || form.value.preferred_days.length < 2) {
      showToast(t('goals.form.validation.minDays'), { type: 'warning' })
      return
    }
    saving.value = true
    try {
      const data = await api.goals.save(form.value)
      goal.value = data
      saved.value = true
      showToast(t('goals.form.toast.saved'), { type: 'success' })
      // refresh progress + week meta to keep bars in sync
      try {
        const p = await api.progress.summary()
        progress.value = p
        goalProgress.value = p.goalProgress || null
        trainingState.value = p.trainingState || null
        records.value = p.records || []
      } catch (error) {
        recordRecoveredError(error)
      }
      try {
        const w = await api.plan.week()
        weekMeta.value = w.weekMeta || null
      } catch (error) {
        recordRecoveredError(error)
      }
      setTimeout(() => (saved.value = false), 2000)
    } catch (e) {
      showToast(apiErrorMessage(e, t('landing.sections.today.toast.saveFailed')), {
        type: 'error',
      })
    } finally {
      saving.value = false
    }
  }

  onMounted(async () => {
    const t0 = Date.now()
    try {
      const data = await api.goals.get()
      if (data) {
        goal.value = data
        form.value = {
          ...form.value,
          ...data,
          goal_date: data.goal_date ? String(data.goal_date).slice(0, 10) : form.value.goal_date,
          target_time_min: data.target_time_min ?? form.value.target_time_min,
        }
      }
    } catch (error) {
      recordRecoveredError(error)
    }
    try {
      const d = await api.progress.summary()
      progress.value = d
      goalProgress.value = d.goalProgress || null
      trainingState.value = d.trainingState || null
      records.value = d.records || []
    } catch (error) {
      recordRecoveredError(error)
    }
    try {
      const w = await api.plan.week()
      weekMeta.value = w.weekMeta || null
      if (!goal.value) goal.value = w.goal || null
    } catch (error) {
      recordRecoveredError(error)
    }
    const elapsed = Date.now() - t0
    if (elapsed < 400) await new Promise((r) => setTimeout(r, 400 - elapsed))
    loading.value = false
  })
  return {
    loading,
    saving,
    saved,
    editing,
    goal,
    weekMeta,
    progress,
    goalProgress,
    trainingState,
    records,
    goalTypeOptions,
    allDays,
    form,
    toggleDay,
    primaryTag,
    primaryTitle,
    primarySubtitle,
    daysUntil,
    countdownPast,
    countdownText,
    badgeOk,
    badgeText,
    primaryPct,
    secondaryRows,
    milestones,
    glanceMetrics,
    prRows,
    save,
  }
}
