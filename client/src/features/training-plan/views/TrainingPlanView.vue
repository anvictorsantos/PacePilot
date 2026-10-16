<template>
  <div class="flex flex-col gap-6">
    <!-- header-block -->
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
        <FlagIcon cls="w-[14px] h-[14px] text-primary shrink-0" />
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
      />

      <NextWeekPreview
        :week-number="nextWeekNumber"
        :items="
          previewCards.map((c) => ({
            badge: $t(c.badgeKey),
            title: $t(c.titleKey),
            desc: $t(c.descKey),
            distance: c.distance,
          }))
        "
      />

      <!-- coach-tip-card -->
      <div
        class="flex sm:flex-row flex-col items-start gap-4 sm:gap-5 bg-card p-5 border border-white/10 rounded-2xl"
      >
        <div
          class="flex justify-center items-center bg-primary/10 p-3 rounded-xl w-[46px] h-[46px] shrink-0"
        >
          <LightBulbIcon cls="w-[22px] h-[22px] text-primary" />
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import FlagIcon from '@/components/icons/FlagIcon.vue'
import LightBulbIcon from '@/components/icons/LightBulbIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import NextWeekPreview from '@/features/training-plan/components/NextWeekPreview.vue'
import WeeklyScheduleGrid from '@/features/training-plan/components/WeeklyScheduleGrid.vue'
import { getPlanAiWeek, getPlanWeek } from '@/services/plan.ts'

const { t, locale } = useI18n()

const week = ref([])
const goal = ref(null)
const weekMeta = ref({ currentWeek: 6, totalWeeks: 12 })
const loading = ref(true)
// AI is a separate, quota-bound call. It never blocks the schedule and never
// gates on its own success — a degraded AI layer must still show the plan.
const aiLoading = ref(false)
const aiNotice = ref('')
// Guards against a duplicate in-flight AI request on re-mount/fast refresh.
let aiRequestInFlight = false

const GOAL_KEY_MAP = {
  half_marathon: 'ui.goal_label.half_marathon',
  marathon: 'ui.goal_label.marathon',
  '5K': 'ui.goal_label.5k',
  '10K': 'ui.goal_label.10k',
  distance_completion: 'ui.goal_label.distance_completion',
  maintain: 'ui.goal_label.maintain',
  general_fitness: 'ui.goal_label.general_fitness',
}

const previewCards = [
  {
    badgeKey: 'ui.preview_badge_intervals',
    titleKey: 'ui.preview_title_aerobic_capacity',
    descKey: 'ui.preview_desc_aerobic_capacity',
    distance: '8.0 km',
  },
  {
    badgeKey: 'ui.preview_badge_tempo',
    titleKey: 'ui.preview_title_lactate_threshold',
    descKey: 'ui.preview_desc_tempo_block',
    distance: '9.0 km',
  },
  {
    badgeKey: 'ui.preview_badge_long',
    titleKey: 'ui.preview_title_endurance_building',
    descKey: 'ui.preview_desc_endurance_run',
    distance: '14.0 km',
  },
]

const headerGoalLabel = computed(() => {
  if (!goal.value?.goal_type) return t('ui.goal_label.fallback')
  return t(GOAL_KEY_MAP[goal.value.goal_type] || 'ui.goal_label.fallback')
})

const taperActive = computed(() => {
  if (!goal.value?.goal_date) return false
  const daysUntil = Math.ceil(
    (new Date(goal.value.goal_date) - new Date().setHours(0, 0, 0, 0)) / 86400000,
  )
  return daysUntil >= 0 && daysUntil <= 14
})

const nextWeekNumber = computed(() =>
  Math.min(weekMeta.value.totalWeeks, weekMeta.value.currentWeek + 1),
)

const weekLabel = computed(() => {
  const weekText = t('ui.week_of_weeks', {
    current: weekMeta.value.currentWeek,
    total: weekMeta.value.totalWeeks,
  })
  if (!week.value.length) return weekText
  const start = new Date(week.value[0].date + 'T12:00:00')
  const end = new Date(week.value[6].date + 'T12:00:00')
  const fmt = (d) =>
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

// Layer AI-authored fields onto the deterministic days, matched by date. The
// workout type/distance/duration from /plan/week are never overwritten.
async function loadAiWeek() {
  if (aiRequestInFlight) return
  aiRequestInFlight = true
  aiLoading.value = true
  try {
    const data = await getPlanAiWeek()
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
          ...day.workout,
          aiExplanation: ai.aiExplanation ?? null,
          aiSuggestedType: ai.aiSuggestedType ?? null,
          aiSuggestionReason: ai.aiSuggestionReason ?? null,
        },
      }
    })
    aiNotice.value = data.cached ? t('ui.ai_cached') : ''
  } catch {
    aiNotice.value = t('ui.ai_unavailable')
  } finally {
    aiLoading.value = false
    aiRequestInFlight = false
  }
}

onMounted(async () => {
  try {
    const data = await getPlanWeek()
    week.value = data.week || []
    goal.value = data.goal || null
    if (data.weekMeta) weekMeta.value = data.weekMeta
  } catch {
    // keep defaults on error
  } finally {
    loading.value = false
  }
  // Schedule is already on screen — fetch coaching copy without blocking it.
  if (!loading.value && week.value.length) loadAiWeek()
})
</script>
