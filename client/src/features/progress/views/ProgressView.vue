<template>
  <div class="flex flex-col gap-6">
    <!-- header-block — mimics TodayWorkoutView 9:527 -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <p class="font-bold text-muted text-xs uppercase leading-none tracking-widest">
          {{ $t('ui.your_journey') }}
        </p>
        <h1 class="font-black text-white text-3xl leading-none tracking-tight">
          {{ $t('ui.progress') }}
        </h1>
      </div>
    </div>

    <ProgressSkeleton v-if="loading" />

    <!-- analytics-columns — mimics Today columns-layout 9:533 -->
    <div
      v-else
      class="flex lg:flex-row flex-col items-start gap-6"
    >
      <!-- left-charts-col — flex-1 like Today left -->
      <div class="flex flex-col flex-1 gap-4 w-full min-w-0">
        <WeeklyVolumeChart
          :data="data?.volumeSeries || []"
          :loading="loading"
        />
        <PaceTrendCard :points="pacePoints" />
      </div>
      <!-- right-stats-col — w-[340px] like Today right -->
      <div class="flex flex-col gap-4 w-full lg:w-[340px] shrink-0">
        <GoalCard
          v-if="goal && weekMeta"
          :goal="goal"
          :week-meta="weekMeta"
        />
        <ConsistencyCard
          v-if="data?.goalProgress"
          :pct="data.goalProgress.pct"
        />
        <IntensityCard
          v-if="data"
          :title="$t('ui.intensity_distribution')"
          :value="data.trainingState.weekly.longRun28"
          unit="km"
          :badge="$t('ui.peak')"
          :hint="$t('ui.intensity_hint')"
          :zones="[
            { label: $t('ui.zone_aerobic'), pct: 70 },
            { label: $t('ui.zone_tempo'), pct: 20 },
            { label: $t('ui.zone_intervals'), pct: 10 },
          ]"
        />
        <FatigueCard
          v-if="data"
          :signals="data.trainingState.fatigueSignals"
        />
      </div>
    </div>

    <SectionDivider v-if="!loading && data" />

    <!-- key-metrics-summary -->
    <div
      v-if="!loading && data"
      class="flex w-full"
    >
      <ProgressStatsGrid
        :data="data"
        class="flex-1"
      />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import WeeklyVolumeChart from '@/components/charts/WeeklyVolumeChart.vue'
import GoalCard from '@/components/shared/GoalCard.vue'
import SectionDivider from '@/components/ui/SectionDivider.vue'
import ConsistencyCard from '@/features/progress/components/ConsistencyCard.vue'
import FatigueCard from '@/features/progress/components/FatigueCard.vue'
import IntensityCard from '@/features/progress/components/IntensityCard.vue'
import PaceTrendCard from '@/features/progress/components/PaceTrendCard.vue'
import ProgressSkeleton from '@/features/progress/components/ProgressSkeleton.vue'
import ProgressStatsGrid from '@/features/progress/components/ProgressStatsGrid.vue'
import { getPlanWeek } from '@/services/plan.js'
import { getProgress } from '@/services/progress.js'
const { t } = useI18n()

const data = ref(null)
const loading = ref(true)
const goal = ref(null)
const weekMeta = ref(null)
const pacePoints = computed(() =>
  (data.value?.paceSeries || []).map((p, i) => ({
    label: t('ui.run_numbered', { n: i + 1 }),
    pace: p.pace,
    hr: p.hr,
  })),
)
onMounted(async () => {
  try {
    const d = await getProgress()
    data.value = d
  } catch {}
  try {
    const w = await getPlanWeek()
    goal.value = w.goal || null
    weekMeta.value = w.weekMeta || null
  } catch {}
  loading.value = false
})
</script>
