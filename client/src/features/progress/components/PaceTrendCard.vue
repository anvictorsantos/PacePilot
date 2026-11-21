<template>
  <div class="flex flex-col items-start p-5 gap-3 w-full rounded-xl border border-white/10 bg-card">
    <div class="flex flex-row justify-between items-baseline gap-3 self-stretch">
      <div class="flex flex-col items-start gap-1 min-w-0 flex-1">
        <p class="text-body font-medium leading-normal text-primary">
          {{ $t('ui.lactate_threshold') }}
        </p>
        <p class="text-label leading-normal text-faint">
          {{ $t('ui.average_pace_trend') }}
        </p>
      </div>
      <p class="font-mono text-label leading-normal text-muted text-right shrink-0">
        {{ deltaLabel }}
      </p>
    </div>

    <div
      v-if="!points?.length"
      class="flex-1 flex items-center text-body text-muted h-[100px]"
    >
      {{ $t('ui.no_pace_data') }}
    </div>
    <div
      v-else
      class="relative self-stretch overflow-hidden h-[100px] w-full"
    >
      <PaceTrendChart
        :poly-points="polyPoints"
        :dots="chartDots"
      />
    </div>

    <div class="flex flex-row justify-between items-start self-stretch">
      <p
        v-for="(p, i) in displayPoints"
        :key="i"
        class="font-mono text-caption leading-label text-faint text-center flex-1"
        :class="`order-[${i}]`"
      >
        {{ p.label }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

import PaceTrendChart from '@/features/progress/components/PaceTrendChart.vue'
import { i18n } from '@/i18n'

interface PaceTrendPoint {
  label?: string | null
  pace?: number | null | undefined
}

const props = defineProps({
  points: { type: Array as PropType<PaceTrendPoint[]>, default: () => [] },
  delta: { type: String, default: '' },
})

const displayPoints = computed(() => {
  const arr = (props.points || []).slice(0, 7)
  if (!arr.length) return []
  return arr.map((p, i) => ({
    label: p.label || i18n.global.t('ui.week_numbered', { n: i + 1 }),
    pace: p.pace,
  }))
})

const deltaLabel = computed(() => {
  if (props.delta) return props.delta
  const pts = displayPoints.value
  if (pts.length < 2) return '—'
  const first = pts[0]?.pace
  const last = pts[pts.length - 1]?.pace
  if (first == null || last == null) return '—'
  const diff = Math.round(first - last)
  if (diff === 0) return i18n.global.t('ui.pace_stable')
  const sign = diff > 0 ? '-' : '+'
  return `${sign}${i18n.global.t(diff > 0 ? 'ui.pace_faster' : 'ui.pace_slower', { s: Math.abs(diff) })}`
})

const chartDots = computed(() => {
  const pts = displayPoints.value
  if (!pts.length) return []
  const paces = pts.map((p) => p.pace ?? 0)
  const min = Math.min(...paces)
  const max = Math.max(...paces)
  const range = max - min || 1
  return pts.map((p, i) => {
    const x = pts.length === 1 ? 256 : (i / (pts.length - 1)) * 512
    const y = 8 + (((p.pace ?? 0) - min) / range) * 84
    const yInv = 8 + 84 - (y - 8)
    return { x: Math.round(x), y: Math.round(yInv) }
  })
})

const polyPoints = computed(() => chartDots.value.map((d) => `${d.x},${d.y}`).join(' '))
</script>
