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
        :items="previewCards"
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
            Coaching Tip: The Science of Tapering
          </p>
          <p class="text-body font-normal leading-relaxed text-muted">
            Reducing volume by 20–25% in the final weeks allows your muscles to repair fully,
            replenishes glycogen stores, and optimizes cardiovascular capacity so you arrive at the
            starting line completely refreshed and primed for peak performance.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

import FlagIcon from '@/components/icons/FlagIcon.vue'
import LightBulbIcon from '@/components/icons/LightBulbIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import NextWeekPreview from '@/features/training-plan/components/NextWeekPreview.vue'
import WeeklyScheduleGrid from '@/features/training-plan/components/WeeklyScheduleGrid.vue'
import { getPlanWeek } from '@/services/plan.js'

const week = ref([])
const goal = ref(null)
const weekMeta = ref({ currentWeek: 6, totalWeeks: 12 })
const loading = ref(true)

const GOAL_LABELS = {
  half_marathon: 'Half Marathon Training Plan',
  marathon: 'Marathon Training Plan',
  '5K': '5K Training Plan',
  '10K': '10K Training Plan',
  distance_completion: 'Distance Training Plan',
  maintain: 'Maintain Fitness Plan',
  general_fitness: 'General Fitness Plan',
}

const previewCards = [
  {
    badge: 'INTERVALS',
    title: 'Aerobic Capacity',
    desc: '5x1000m hard intervals with resting recoveries.',
    distance: '8.0 km',
  },
  {
    badge: 'TEMPO RUN',
    title: 'Lactate Threshold',
    desc: '5.0 km sustained hard tempo block.',
    distance: '9.0 km',
  },
  {
    badge: 'LONG RUN',
    title: 'Endurance Building',
    desc: 'Long progressive endurance run.',
    distance: '14.0 km',
  },
]

const headerGoalLabel = computed(() => {
  if (!goal.value?.goal_type) return 'Half Marathon Training Plan'
  return GOAL_LABELS[goal.value.goal_type] || 'Training Plan'
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
  if (!week.value.length)
    return `WEEK ${weekMeta.value.currentWeek} OF ${weekMeta.value.totalWeeks}`
  const start = new Date(week.value[0].date + 'T12:00:00')
  const end = new Date(week.value[6].date + 'T12:00:00')
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()
  return `WEEK ${weekMeta.value.currentWeek} OF ${weekMeta.value.totalWeeks} (${fmt(start)} – ${fmt(end)})`
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
