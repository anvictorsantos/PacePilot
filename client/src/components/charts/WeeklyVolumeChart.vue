<template>
  <Skeleton v-if="loading" />
  <div
    v-else
    class="flex flex-col items-start p-5 gap-3 self-stretch w-full rounded-xl border border-white/10 bg-card"
  >
    <div class="flex flex-row justify-between items-baseline gap-3 self-stretch">
      <div class="flex flex-col items-start gap-0.5 min-w-0 flex-1">
        <p class="text-body font-medium leading-normal text-primary">
          {{ $t('ui.weekly_training_volume') }}
        </p>
        <p class="text-label leading-normal text-faint">
          {{ $t('ui.progression_over_8_weeks') }}
        </p>
      </div>
      <p class="font-mono text-label leading-normal text-muted text-right shrink-0">
        {{ $t('ui.peak_volume', { peakLabel }) }}
      </p>
    </div>

    <div
      v-if="!data || !data.length"
      class="text-body text-muted flex-1 flex items-center"
    >
      {{ $t('ui.no_volume_data') }}
    </div>

    <div
      v-else
      class="flex flex-row items-end gap-[3px] self-stretch w-full h-[140px]"
    >
      <div
        v-for="(d, i) in displayData"
        :key="d.label"
        class="flex flex-col justify-end items-center gap-2 self-stretch flex-1"
        :class="`order-[${i}]`"
      >
        <div class="flex flex-col justify-end items-center self-stretch h-[110px]">
          <div
            class="w-full rounded-t-sm"
            :class="d.active ? 'bg-primary' : 'bg-[#2a2a32]'"
            :style="{ height: `${d.height}px` }"
          ></div>
        </div>
        <p
          class="font-mono text-caption leading-normal text-center"
          :class="d.active ? 'text-primary' : 'text-faint'"
        >
          {{ d.label }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

import Skeleton from '@/components/ui/Skeleton.vue'
import type { VolumePoint } from '@/modules/progress/infrastructure/dto/VolumePoint.ts'

const props = defineProps({
  data: { type: Array as PropType<VolumePoint[]>, default: () => [] },
  loading: { type: Boolean, default: false },
})

const peakLabel = computed(() => {
  if (!props.data?.length) return '—'
  const m = Math.max(...props.data.map((d) => d.distance ?? 0))
  return `${m.toFixed(1)} km`
})

const displayData = computed(() => {
  const arr = (props.data || []).slice(0, 8)
  while (arr.length < 8) arr.push({ label: `W${arr.length + 1}`, distance: 0 })
  const max = Math.max(1, ...arr.map((d) => d.distance ?? 0))
  const peakIdx = arr.reduce(
    (best, d, i) => ((d.distance ?? 0) > (arr[best]?.distance ?? -1) ? i : best),
    0,
  )
  const maxH = 103
  const minH = 12
  return arr.map((d, i) => {
    const h = d.distance ? Math.round(Math.max(minH, (d.distance / max) * maxH)) : minH
    return {
      label: d.label || `W${i + 1}`,
      height: h,
      active: i === peakIdx && (d.distance ?? 0) > 0,
    }
  })
})
</script>
