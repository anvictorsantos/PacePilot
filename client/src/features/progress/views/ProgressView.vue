<template>
  <div class="flex flex-col gap-5">
    <div class="flex justify-between items-start gap-6">
      <div>
        <p class="mb-1.5 font-mono text-label text-faint">{{ $t('ui.your_journey') }}</p>
        <h1 class="font-medium text-page text-primary tracking-tight leading-none">
          {{ $t('ui.progress') }}
        </h1>
      </div>
      <div
        v-if="data"
        class="font-mono text-label text-muted text-right leading-relaxed"
      >
        {{ data.totalActivities }} {{ $t('ui.synced_runs') }}<br />
        {{ data.trainingState?.trend }}
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
        class="cursor-pointer inline-flex justify-center items-center bg-primary hover:bg-primaryBright mt-5 px-4 py-2 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-medium text-body text-background transition"
        @click="reload(true)"
      >
        {{ $t('common.retry') }}
      </button>
    </EmptyState>

    <template v-else>
      <ProgressStatsGrid
        v-if="data"
        :data="data"
      />

      <div class="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        <PaceTrendCard :points="pacePoints" />

        <div class="flex flex-col gap-4 min-w-0">
          <WeeklyVolumeChart
            :data="data?.volumeSeries || []"
            :loading="loading"
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
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import WeeklyVolumeChart from '@/components/charts/WeeklyVolumeChart.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
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

const { t } = useI18n()

// Shared process-wide Resource cache: navigating between views does not
// re-request /progress.
const { data, loading, error, reload } = useResource<ProgressResponse>('progress.summary', () =>
  api.progress.summary(),
)

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
