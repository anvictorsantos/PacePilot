<template>
  <div class="flex flex-col gap-6 w-full min-w-0">
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col gap-1">
        <p class="font-bold text-label text-muted uppercase tracking-widest">
          {{ headerGoalLabel }}
        </p>
        <h1 class="font-black text-h2 text-white leading-none">{{ $t('ui.weekly_schedule') }}</h1>
      </div>
      <div
        v-if="taperActive"
        class="flex items-center gap-2 bg-primary/10 px-3 py-2 border border-primary rounded-full shrink-0"
      >
        <FlagIcon cls="w-[14px] h-[14px] text-primaryBright shrink-0" />
        <span class="font-bold text-white text-xs whitespace-nowrap">{{
          $t('ui.2_week_training_taper_active')
        }}</span>
      </div>
    </div>

    <Skeleton
      v-if="loading"
      class="mt-2"
    />

    <template v-else>
      <WeeklyScheduleGrid
        :week="week"
        :week-label="weekLabel"
        :today-completed="todayCompleted"
      />

      <NextWeekPreview
        v-if="previewCards.length"
        :week-number="previewWeekNumber"
        :items="
          previewCards.map((c) => ({
            badge: $t(c.badgeKey),
            title: $t(c.titleKey),
            desc: $t(c.descKey),
            distance: c.distance,
            date: c.date,
          }))
        "
      />

      <div
        class="flex sm:flex-row flex-col items-start gap-4 sm:gap-5 bg-card p-5 border border-white/10 rounded-2xl"
      >
        <div
          class="flex justify-center items-center bg-primary/10 p-3 rounded-xl w-[46px] h-[46px] shrink-0"
        >
          <LightBulbIcon cls="w-[22px] h-[22px] text-primaryBright" />
        </div>
        <div class="flex flex-col flex-1 gap-1 min-w-0">
          <p class="font-bold text-lead text-white leading-none">
            {{ coachTipTitle }}
          </p>
          <p class="font-normal text-body text-muted leading-relaxed">
            <template v-if="aiLoading">{{ $t('ui.ai_tip_loading') }}</template>
            <template v-else>{{ coachTipText }}</template>
          </p>
          <p
            v-if="aiNotice"
            class="text-caption text-faint"
          >
            {{ aiNotice }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FlagIcon from '@/components/icons/FlagIcon.vue'
import LightBulbIcon from '@/components/icons/LightBulbIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import NextWeekPreview from '@/features/training-plan/components/NextWeekPreview.vue'
import WeeklyScheduleGrid from '@/features/training-plan/components/WeeklyScheduleGrid.vue'
import { previewSessions } from '@/features/training-plan/preview-sessions.ts'
import type { AiLocale } from '@/modules/ai/infrastructure/dto/PlanAiLocale.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { useAnalytics } from '@/modules/analytics/infrastructure/composable/useAnalytics.ts'
import type { Goal } from '@/modules/goals/infrastructure/dto/Goal.ts'
import { useRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import { formatPlanDistance } from '@/modules/shared/ui/format.ts'
import {
  goalPlanLabel,
  workoutBadgeKey,
  workoutLabelKey,
  workoutPurposeKey,
} from '@/modules/shared/ui/training-vocabulary.ts'
import type { WeekMetaPrimitives } from '@/modules/training/domain/value-object/WeekMeta.ts'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'
import type { PlanNextWeek } from '@/modules/training/infrastructure/dto/PlanNextWeek.ts'

const { t, locale } = useI18n()
const { trackEvent } = useAnalytics()
const { completed: todayCompleted, refresh: refreshRunDay } = useRunDay()

const week = ref<PlanDay[]>([])
const goal = ref<Goal | null>(null)
const weekMeta = ref<WeekMetaPrimitives>({ currentWeek: 6, totalWeeks: 12 })
const loading = ref(true)
// AI is a separate, quota-bound call: it never blocks the schedule, and a
// degraded AI layer must still show the plan.
const aiLoading = ref(false)
const aiNotice = ref('')
let aiRequestInFlight = false
// A locale switch during an open request re-runs once it settles, so the last
// selection wins instead of being silently dropped.
let pendingLocale: AiLocale | null = null
// PlanGenerated fires once per week, not once per locale: a language switch is
// not a second plan generation.
const aiGeneratedWeeks = new Set<string>()

function activeLocale(): AiLocale {
  return locale.value === 'en' ? 'en' : 'pt'
}

const nextWeek = ref<PlanNextWeek | null>(null)

/** Catalogue keys rather than text, so the list follows a language switch. */
const previewCards = computed(() => {
  const sessions = previewSessions(nextWeek.value?.week)
  // Reading the locale here is what makes a language switch reformat the dates.
  const formatter = new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'pt-PT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return sessions.flatMap((session) => {
    const badgeKey = workoutBadgeKey(session.type)
    const titleKey = workoutLabelKey(session.type)
    const descKey = workoutPurposeKey(session.type)
    if (!badgeKey || !titleKey || !descKey) return []
    return [
      {
        badgeKey,
        titleKey,
        descKey,
        distance: formatPlanDistance(session.distanceKm),
        date: session.date ? formatter.format(new Date(`${session.date}T12:00:00`)) : '',
      },
    ]
  })
})

const previewWeekNumber = computed(
  () => nextWeek.value?.weekMeta?.currentWeek ?? nextWeekNumber.value,
)

const headerGoalLabel = computed(() => goalPlanLabel(goal.value?.goal_type))

const taperActive = computed(() => {
  if (!goal.value?.goal_date) return false
  const daysUntil = Math.ceil(
    (new Date(goal.value.goal_date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  )
  return daysUntil >= 0 && daysUntil <= 14
})

const nextWeekNumber = computed(() =>
  Math.min(weekMeta.value.totalWeeks ?? 0, (weekMeta.value.currentWeek ?? 0) + 1),
)

const weekLabel = computed(() => {
  const weekText = t('ui.week_of_weeks', {
    current: weekMeta.value.currentWeek,
    total: weekMeta.value.totalWeeks,
  })
  if (!week.value.length) return weekText
  const first = week.value[0]
  const last = week.value[6]
  if (!first || !last) return weekText
  const start = new Date((first.date ?? '') + 'T12:00:00')
  const end = new Date((last.date ?? '') + 'T12:00:00')
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale.value, { month: 'long', day: 'numeric' }).toUpperCase()
  return `${weekText} (${fmt(start)} – ${fmt(end)})`
})

const coachTipTitle = computed(() => {
  return t('ui.coaching_tip_taper_title')
})

const coachTipText = computed(() => {
  const tip = week.value
    .flatMap((d) => (d.workout?.aiExplanation ? [d.workout.aiExplanation] : []))
    .find(Boolean)
  return tip || t('ui.coaching_tip_taper_desc')
})

// AI fields are layered onto the deterministic days by date; the server's
// workout type, distance and duration are never overwritten.
async function loadAiWeek() {
  if (aiRequestInFlight) {
    pendingLocale = activeLocale()
    return
  }
  aiRequestInFlight = true
  const requested = activeLocale()
  aiLoading.value = true
  aiNotice.value = ''
  try {
    const data = await api.plan.aiWeek(requested)
    // A newer locale was chosen while this was in flight: discard the answer
    // rather than painting captions in the language the athlete just left.
    if (requested !== activeLocale()) {
      pendingLocale = activeLocale()
      return
    }
    if (data.degraded) {
      aiNotice.value = t('ui.ai_unavailable')
      return
    }
    const byDate = new Map((data.week || []).map((d) => [d.date, d]))
    week.value = week.value.map((day) => {
      const ai = byDate.get(day.date)
      if (!ai) return day
      return {
        ...day,
        workout: {
          ...(day.workout ?? {}),
          aiExplanation: ai.aiExplanation ?? null,
          aiSuggestedType: ai.aiSuggestedType ?? null,
          aiSuggestionReason: ai.aiSuggestionReason ?? null,
        },
      }
    })
    aiNotice.value = data.cached ? t('ui.ai_cached') : ''
    // A cached week is a read, not a generation, and the same week in another
    // language is the same generation — neither counts as a new funnel step.
    if (!data.cached) {
      const weekKey = week.value[0]?.date ?? ''
      if (weekKey && !aiGeneratedWeeks.has(weekKey)) {
        aiGeneratedWeeks.add(weekKey)
        trackEvent(AnalyticsEventName.PlanGenerated, { locale: requested })
      }
    }
  } catch {
    if (requested === activeLocale()) aiNotice.value = t('ui.ai_unavailable')
  } finally {
    aiLoading.value = false
    aiRequestInFlight = false
    const next = pendingLocale
    pendingLocale = null
    if (next && next !== requested) void loadAiWeek()
  }
}

// A language switch refetches the prose; the server caches per locale.
watch(locale, () => {
  if (week.value.length) void loadAiWeek()
})

onMounted(async () => {
  // Run-day truth colours today's card green when the session is already done.
  void refreshRunDay()
  try {
    const data = await api.plan.week()
    week.value = data.week || []
    goal.value = data.goal || null
    nextWeek.value = data.nextWeek ?? null
    if (data.weekMeta) weekMeta.value = data.weekMeta
  } catch {
    // Keep the current week on screen; a failed fresh read is not fatal.
  } finally {
    loading.value = false
  }
  // Schedule is already on screen — fetch coaching copy without blocking it.
  if (!loading.value && week.value.length) loadAiWeek()
})
</script>
