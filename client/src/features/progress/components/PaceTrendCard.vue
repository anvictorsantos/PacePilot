<template>
  <div
    class="flex flex-col items-start p-5 gap-4 self-stretch w-full rounded-2xl border border-white/10 bg-card"
  >
    <div class="flex flex-row justify-between items-center self-stretch">
      <div class="flex flex-col items-start gap-1 min-w-0 flex-1">
        <p class="font-bold text-label leading-label uppercase tracking-widest text-muted">
          {{ $t('ui.lactate_threshold') }}
        </p>
        <p class="font-extrabold text-lg leading-[22px] text-white">
          {{ $t('ui.average_pace_trend') }}
        </p>
      </div>
      <p class="font-bold text-sm leading-[17px] text-success text-right shrink-0">
        {{ deltaLabel }}
      </p>
    </div>

    <div
      v-if="!points?.length"
      class="flex-1 flex items-center text-sm text-muted h-[100px]"
    >
      {{ $t('ui.no_pace_data') }}
    </div>
    <div
      v-else
      class="relative self-stretch overflow-hidden h-[100px] w-full"
    >
      <svg
        :width="512"
        :height="100"
        viewBox="0 0 512 100"
        class="absolute inset-0 w-full h-full"
      >
        <line
          x1="0"
          y1="50"
          x2="512"
          y2="50"
          stroke="rgba(255,255,255,0.101961)"
          stroke-width="1"
          stroke-dasharray="6 6"
        />
        <polyline
          :points="polyPoints"
          fill="none"
          stroke="#F97316"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle
          v-for="(p, i) in chartDots"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          r="4"
          fill="#F97316"
          stroke="#0B0B0F"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <div class="flex flex-row justify-between items-start self-stretch">
      <p
        v-for="(p, i) in displayPoints"
        :key="i"
        class="font-normal text-label leading-label text-muted text-center flex-1"
        :class="`order-[${i}]`"
      >
        {{ p.label }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps({
  points: { type: Array, default: () => [] },
  delta: { type: String, default: '' },
})

const displayPoints = computed(() => {
  const arr = (props.points || []).slice(0, 7)
  if (!arr.length) return []
  return arr.map((p, i) => ({ label: p.label || `W${i + 1}`, pace: p.pace }))
})

const deltaLabel = computed(() => {
  if (props.delta) return props.delta
  const pts = displayPoints.value
  if (pts.length < 2) return '—'
  const first = pts[0]?.pace
  const last = pts[pts.length - 1]?.pace
  if (first == null || last == null) return '—'
  const diff = Math.round(first - last)
  if (diff === 0) return 'Stable pace'
  const sign = diff > 0 ? '-' : '+'
  return `${sign}${Math.abs(diff)}s/km ${diff > 0 ? 'faster' : 'slower'}`
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
    const y = 8 + ((p.pace - min) / range) * 84
    const yInv = 8 + 84 - (y - 8)
    return { x: Math.round(x), y: Math.round(yInv) }
  })
})

const polyPoints = computed(() => chartDots.value.map((d) => `${d.x},${d.y}`).join(' '))
</script>
