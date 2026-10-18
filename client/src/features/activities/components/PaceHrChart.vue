<template>
  <div class="bg-card border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
    <div class="flex justify-between items-center gap-4">
      <p class="font-bold text-xs uppercase tracking-widest text-muted">
        {{ $t('ui.pace_heart_rate_over_distance') }}
      </p>
      <div class="flex items-center gap-4 shrink-0">
        <span class="flex items-center gap-1.5"
          ><span class="w-3 h-0.5 rounded bg-primary shrink-0" />
          <span class="font-bold text-xs text-primary">{{ $t('ui.pace') }}</span></span
        >
        <span class="flex items-center gap-1.5"
          ><span class="w-3 h-0.5 rounded bg-blue-500 shrink-0" />
          <span class="font-bold text-xs text-blue-500">{{ $t('ui.heart_rate') }}</span></span
        >
      </div>
    </div>

    <div
      v-if="!hasData"
      class="h-40 flex items-center justify-center text-sm text-muted"
    >
      {{ $t('ui.no_stream_data') }}
    </div>
    <div
      v-else
      class="h-40"
      role="img"
      :aria-label="chartAriaLabel"
    >
      <Line
        :data="chartData"
        :options="options"
        aria-hidden="true"
      />
    </div>

    <div
      v-if="hasData"
      class="flex justify-between text-caption text-muted"
    >
      <span
        v-for="l in xLabels"
        :key="l"
        >{{ l }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as C,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js'
import { computed, type PropType } from 'vue'
import { Line } from 'vue-chartjs'

import { i18n } from '@/i18n'
import type { ActivityStreams } from '@/modules/activities/infrastructure/dto/ActivityStreams.ts'
import { paceFromSec } from '@/utils/training-vocabulary.ts'
C.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps({
  streams: { type: Object as PropType<ActivityStreams | null>, default: null }, // { time, distance, velocity_smooth, heartrate }
  distanceKm: { type: Number as PropType<number | null>, default: null },
})

const hasData = computed(
  () => !!(props.streams?.distance?.length && props.streams?.velocity_smooth?.length),
)

// downsample to ~80 points so chartjs stays cheap
function downsample(arr: number[] | null | undefined, n = 80): number[] {
  if (!arr || arr.length <= n) return arr || []
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)] ?? 0)
}

const chartData = computed(() => {
  if (!hasData.value) return { labels: [], datasets: [] }
  const dist = downsample(props.streams?.distance, 80).map((d) => +(d / 1000).toFixed(2))
  const vel = downsample(props.streams?.velocity_smooth, 80)
  const hr = downsample(props.streams?.heartrate, 80)
  // pace sec/km from velocity m/s
  const pace = vel.map((v) => (v ? 1000 / v : null))
  return {
    labels: dist,
    datasets: [
      {
        label: i18n.global.t('ui.pace'),
        data: pace,
        borderColor: '#F97316',
        backgroundColor: 'transparent',
        yAxisID: 'yPace',
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2.5,
      },
      {
        label: i18n.global.t('ui.heart_rate'),
        data: hr,
        borderColor: '#3B82F6',
        backgroundColor: 'transparent',
        yAxisID: 'yHr',
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }
})

const tot = computed(
  () =>
    props.distanceKm ??
    (props.streams?.distance
      ? (props.streams.distance[props.streams.distance.length - 1] ?? 0) / 1000
      : 5.2),
)
const xLabels = computed(() => {
  const t = tot.value || 5.2
  return [
    `0.0 km`,
    `${(t * 0.29).toFixed(1)} km`,
    `${(t * 0.58).toFixed(1)} km`,
    `${(t * 0.87).toFixed(1)} km`,
    `${t.toFixed(1)} km`,
  ]
})

const options: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1A1A21',
      titleColor: '#A1A1AA',
      bodyColor: '#fff',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      displayColors: false,
      padding: 10,
      callbacks: {
        title: (items) => `${items[0]?.label ?? ''} km`,
        label: (ctx) => {
          const v = ctx.parsed.y
          if (v == null) return ''
          if (ctx.dataset.label === i18n.global.t('ui.pace'))
            return ` ${i18n.global.t('ui.pace')} ${paceFromSec(v)}`
          return ` ${i18n.global.t('ui.heart_rate')} ${Math.round(v)} ${i18n.global.t('ui.bpm')}`
        },
      },
    },
  },
  scales: {
    x: { display: false },
    yPace: { position: 'left', display: false, reverse: true },
    yHr: { position: 'right', display: false },
  },
}

const chartAriaLabel = computed(() => {
  if (!hasData.value) return i18n.global.t('ui.chart_pace_hr_aria')
  const paceData = chartData.value.datasets[0]?.data?.filter((v) => v != null) || []
  const hrData = chartData.value.datasets[1]?.data?.filter((v) => v != null) || []
  const avgPace = paceData.length
    ? Math.round(paceData.reduce((a, b) => a + b, 0) / paceData.length)
    : null
  const avgHr = hrData.length ? Math.round(hrData.reduce((a, b) => a + b, 0) / hrData.length) : null
  const unknown = i18n.global.t('ui.unknown')
  const paceStr = avgPace ? paceFromSec(avgPace) : unknown
  const hrStr = avgHr ? `${avgHr} ${i18n.global.t('ui.bpm')}` : unknown
  return i18n.global.t('ui.chart_pace_hr_summary', {
    km: tot.value?.toFixed(1) ?? unknown,
    pace: paceStr,
    hr: hrStr,
  })
})
</script>
