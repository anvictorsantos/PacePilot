import { ref, computed, onMounted } from 'vue'

import { i18n } from '@/i18n'
import type { ProgressResponse } from '@/modules/progress/infrastructure/dto/ProgressResponse.ts'
import type { VolumePoint } from '@/modules/progress/infrastructure/dto/VolumePoint.ts'
import { refreshRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'
import { formatPace } from '@/modules/shared/ui/format.ts'
import {
  intensityDotClass as intensityDot,
  intensityLabel as intensityText,
  workoutLabel,
} from '@/modules/shared/ui/training-vocabulary.ts'
import {
  isRestWorkout,
  toWorkoutType,
  WorkoutType,
} from '@/modules/training/domain/value-object/WorkoutType.ts'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'
import type { PlanTodayResponse } from '@/modules/training/infrastructure/dto/PlanTodayResponse.ts'
import type { PlanWeekResponse } from '@/modules/training/infrastructure/dto/PlanWeekResponse.ts'

// Presentation state for the Today view; run-day truth (whether the run happened,
// which activity, the logged Feedback) lives in `@/run-day/useRunDay.ts`.
export function useTodayWorkout() {
  const data = ref<PlanTodayResponse | null>(null)
  const loading = ref<boolean>(true)
  const weekMeta = ref<PlanWeekResponse['weekMeta']>(null)
  const week = ref<PlanDay[]>([])
  const goal = ref<PlanWeekResponse['goal']>(null)
  const volumeSeries = ref<VolumePoint[]>([])
  const trainingState = ref<ProgressResponse['trainingState']>(null)
  const goalPanelFromProgress = ref(false)

  const headerDate = computed(() => {
    const locale = i18n.global.locale.value === 'pt' ? 'pt-PT' : 'en-US'
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })
  const headerDateShort = computed(() => {
    const locale = i18n.global.locale.value === 'pt' ? 'pt-PT' : 'en-US'
    return (
      new Date().toLocaleDateString(locale, { month: 'short', day: 'numeric' }) +
      ' ' +
      i18n.global.t('ui.session')
    )
  })
  const isRest = computed(() => {
    const t = data.value?.recommendation?.type || data.value?.workout?.type || ''
    return isRestWorkout(t) || Boolean(data.value?.isRest)
  })
  const workoutTypeLabel = computed(() => {
    const t = data.value?.recommendation?.type || data.value?.workout?.type || 'workout'
    return isRestWorkout(t) ? i18n.global.t('ui.rest') : workoutLabel(t)
  })
  const intensityLabel = computed(() => {
    const t = data.value?.recommendation?.type || data.value?.workout?.type || ''
    return intensityText(t) || data.value?.recommendation?.intensity || '—'
  })
  const intensityDotClass = computed(() =>
    intensityDot(data.value?.recommendation?.type || data.value?.workout?.type || ''),
  )
  const displayDistance = computed(() => {
    const d = data.value?.recommendation?.distance_km
    return d != null ? Number(d).toFixed(1) : '—'
  })
  const displayDuration = computed(() => data.value?.recommendation?.duration_min ?? '—')
  const displayPace = computed(() => data.value?.recommendation?.target_pace || '—')
  const warmupText = computed(() => data.value?.recommendation?.warmup || '—')
  const mainSub = computed(() =>
    data.value?.recommendation?.target_pace
      ? `${data.value.recommendation.target_pace} ${i18n.global.t('ui.pace_unit')}`
      : data.value?.recommendation?.main_set || '',
  )
  const cooldownText = computed(() => data.value?.recommendation?.cooldown || '—')
  const warmupSub = computed(() => i18n.global.t('ui.easy_pace'))
  const cooldownSub = computed(() => i18n.global.t('ui.easy_pace'))
  const mainLabel = computed(() => {
    const type = toWorkoutType(data.value?.recommendation?.type)
    if (type === WorkoutType.Tempo) return i18n.global.t('ui.main_tempo_block')
    if (type === WorkoutType.Interval || type === WorkoutType.Intervals)
      return i18n.global.t('ui.main_intervals')
    if (type === WorkoutType.Threshold) return i18n.global.t('ui.main_threshold')
    if (type === WorkoutType.Steady) return i18n.global.t('ui.main_steady_block')
    if (type === WorkoutType.Long) return i18n.global.t('ui.main_long_run')
    if (type === WorkoutType.Easy) return i18n.global.t('ui.main_main_set')
    return i18n.global.t('ui.main_main_block')
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
      ? i18n.global.t('ui.coaching_stay_consistent')
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
        prev = vs[i]?.distance ?? 0
        break
      }
    if (!prev && vs.length >= 2) prev = vs[Math.max(0, lastIdx - 1)]?.distance ?? 0
    let deltaSub = '—'
    let deltaTone = 'muted'
    if (prev > 0) {
      const pct = Math.round(((last - prev) / prev) * 100)
      if (pct > 0) {
        deltaSub = i18n.global.t('ui.plus_pct_vs_last_week', { pct })
        deltaTone = 'success'
      } else if (pct < 0) {
        deltaSub = i18n.global.t('ui.minus_pct_vs_last_week', { pct })
        deltaTone = 'muted'
      } else {
        deltaSub = i18n.global.t('ui.on_track')
        deltaTone = 'muted'
      }
    } else if (last > 0) {
      deltaSub = i18n.global.t('ui.first_week')
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
        ? i18n.global.t('ui.on_track')
        : consistencyPct >= 60
          ? i18n.global.t('ui.consistency_building')
          : i18n.global.t('ui.consistency_needs_attention')
      : '—'

    return [
      {
        label: i18n.global.t('ui.insight_weekly_distance'),
        value: `${Number(last).toFixed(1)} km`,
        sub: deltaSub,
        tone: deltaTone,
      },
      {
        label: i18n.global.t('ui.insight_hard_sessions'),
        value: `${hard} / wk`,
        sub:
          hard >= 3
            ? i18n.global.t('ui.hard_load_high')
            : hard === 0
              ? i18n.global.t('ui.hard_load_recovery')
              : i18n.global.t('ui.on_track'),
        tone: hard >= 3 ? 'success' : 'muted',
      },
      {
        label: i18n.global.t('ui.avg_pace'),
        value: paceStr,
        sub: paceSec ? i18n.global.t('ui.pace_sub_optimal') : '—',
        tone: 'muted',
      },
      {
        label: i18n.global.t('ui.insight_consistency'),
        value: consistencyPct ? `${consistencyPct}%` : '—',
        sub: consistencySub,
        tone: consistencyPct >= 80 ? 'success' : 'muted',
      },
    ]
  })

  const hasGoalPanel = computed(() =>
    Boolean(week.value.length || goal.value || goalPanelFromProgress.value),
  )

  const volumeActiveIndex = computed(() => {
    // Highlight the last bar: the live path's rolling window ends on this week.
    if (!volumeSeries.value?.length) return -1
    return volumeSeries.value.length - 1
  })

  onMounted(async () => {
    // One parallel batch: four sequential calls would be four round trips.
    const [todayRes, weekRes, progRes] = await Promise.allSettled([
      api.plan.today(),
      api.plan.week(),
      api.progress.summary(),
      refreshRunDay(),
    ])
    try {
      if (todayRes.status === 'fulfilled') data.value = todayRes.value
    } catch (error) {
      recordRecoveredError(error)
    }
    try {
      if (weekRes.status === 'fulfilled') {
        const w = weekRes.value
        week.value = w.week || []
        weekMeta.value = w.weekMeta || null
        goal.value = w.goal || null
      }
    } catch (error) {
      recordRecoveredError(error)
    }
    try {
      if (progRes.status === 'fulfilled') {
        const p = progRes.value
        volumeSeries.value = p.volumeSeries || []
        trainingState.value = p.trainingState || null
        // `goalProgress` is not a Goal (no goal_type, no goal_date) — it only
        // tells us the panel has something to show when the week carried no goal.
        goalPanelFromProgress.value = !week.value.length && !goal.value && Boolean(p.goalProgress)
      }
    } catch (error) {
      recordRecoveredError(error)
    }
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
    goal,
    hasGoalPanel,
    headerDate,
    headerDateShort,
    insightCards,
    intensityDotClass,
    intensityLabel,
    isRest,
    loading,
    mainDist,
    mainLabel,
    mainSub,
    totalKm,
    trainingState,
    volumeActiveIndex,
    volumeSeries,
    warmupDist,
    warmupSub,
    warmupText,
    week,
    weekMeta,
    workoutTypeLabel,
  }
}
