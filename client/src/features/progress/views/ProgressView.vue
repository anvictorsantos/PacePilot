<template>
  <div class="flex flex-col gap-6">
    <!-- mimics TodayWorkoutView 9:527 -->
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

    <EmptyState
      v-else-if="error"
      :title="$t('common.loadFailed')"
      :message="$t('ui.no_insights_yet')"
    >
      <button
        type="button"
        class="cursor-pointer inline-flex justify-center items-center bg-primary hover:bg-primaryBright mt-5 px-4 py-2 rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-bold text-body text-background transition"
        @click="reload(true)"
      >
        {{ $t('common.retry') }}
      </button>
    </EmptyState>

    <!-- mimics Today columns-layout 9:533 -->
    <div
      v-else
      class="flex lg:flex-row flex-col items-start gap-6"
    >
      <div class="flex flex-col flex-1 gap-4 w-full min-w-0">
        <WeeklyVolumeChart
          :data="data?.volumeSeries || []"
          :loading="loading"
        />
        <PaceTrendCard :points="pacePoints" />
      </div>
      <div class="flex flex-col gap-4 w-full lg:w-[340px] shrink-0">
        <GoalCard
          v-if="goal && weekMeta"
          :goal="goal"
          :week-meta="weekMeta"
        />
        <ConsistencyCard
          v-if="consistencyPct != null"
          :pct="consistencyPct"
        />
        <IntensityCard
          v-if="data"
          :title="$t('ui.intensity_distribution')"
          :value="longRun28"
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
          :signals="fatigueSignals"
        />
      </div>
    </div>

    <SectionDivider v-if="!loading && data" />

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
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import WeeklyVolumeChart from '@/components/charts/WeeklyVolumeChart.vue'
import GoalCard from '@/components/shared/GoalCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SectionDivider from '@/components/ui/SectionDivider.vue'
import ConsistencyCard from '@/features/progress/components/ConsistencyCard.vue'
import FatigueCard from '@/features/progress/components/FatigueCard.vue'
import IntensityCard from '@/features/progress/components/IntensityCard.vue'
import PaceTrendCard from '@/features/progress/components/PaceTrendCard.vue'
import ProgressSkeleton from '@/features/progress/components/ProgressSkeleton.vue'
import ProgressStatsGrid from '@/features/progress/components/ProgressStatsGrid.vue'
import type { PacePoint } from '@/modules/progress/infrastructure/dto/PacePoint.ts'
import type { ProgressResponse } from '@/modules/progress/infrastructure/dto/ProgressResponse.ts'
import { useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import type { PlanWeekResponse } from '@/modules/training/infrastructure/dto/PlanWeekResponse.ts'

const { t } = useI18n()

// Both reads share the process-wide Resource cache, so navigating between views
// does not re-request /progress or /plan/week.
const { data, loading, error, reload } = useResource<ProgressResponse>('progress.summary', () =>
  api.progress.summary(),
)
const { data: week } = useResource<PlanWeekResponse>('plan.week', () => api.plan.week())

const goal = computed(() => week.value?.goal ?? null)
const weekMeta = computed(() => week.value?.weekMeta ?? null)
const pacePoints = computed(() =>
  (data.value?.paceSeries ?? []).map((p: PacePoint, i) => ({
    label: t('ui.run_numbered', { n: i + 1 }),
    pace: p.pace,
    hr: p.hr,
  })),
)
const longRun28 = computed(() => data.value?.trainingState?.weekly?.longRun28 ?? 0)
const fatigueSignals = computed(() => data.value?.trainingState?.fatigueSignals ?? [])
const consistencyPct = computed(() => data.value?.goalProgress?.pct ?? null)
</script>
