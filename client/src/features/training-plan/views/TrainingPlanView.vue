<template>
  <div class="flex flex-col gap-6">
    <!-- header-block -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex flex-col gap-1">
        <p class="text-label font-bold uppercase tracking-widest text-muted">
          {{ headerGoalLabel }}
        </p>
        <h1 class="text-h2 font-black leading-none text-white">{{ $t('ui.weekly_schedule') }}</h1>
      </div>
      <div
        v-if="taperActive"
        class="flex shrink-0 items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-2"
      >
        <FlagIcon cls="w-[14px] h-[14px] text-primary shrink-0" />
        <span class="text-xs font-bold text-white whitespace-nowrap">{{
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
      <div class="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-5">
        <div
          class="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-primary/10 p-3"
        >
          <LightBulbIcon cls="w-[22px] h-[22px] text-primary" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="text-lead font-bold leading-none text-white">
            {{ $t('ui.coaching_tip_taper_title') }}
          </p>
          <p class="text-body font-normal leading-relaxed text-muted">
            {{ $t('ui.coaching_tip_taper_desc') }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import FlagIcon from '@/components/icons/FlagIcon.vue'
import LightBulbIcon from '@/components/icons/LightBulbIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import NextWeekPreview from '@/features/training-plan/components/NextWeekPreview.vue'
import WeeklyScheduleGrid from '@/features/training-plan/components/WeeklyScheduleGrid.vue'
import { getPlanWeek } from '@/services/plan.js'

const { t, locale } = useI18n()

const week = ref([])
const goal = ref(null)
const weekMeta = ref({ currentWeek: 6, totalWeeks: 12 })
const loading = ref(true)

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
})
</script>
