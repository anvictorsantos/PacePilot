<template>
  <Skeleton v-if="loading" />
  <div
    v-else
    class="flex flex-col items-start p-5 gap-4 self-stretch w-full rounded-2xl border border-white/10 bg-card"
  >
    <div class="flex flex-row justify-between items-center self-stretch">
      <div class="flex flex-col items-start gap-1 min-w-0 flex-1">
        <p class="font-bold text-label leading-label uppercase tracking-widest text-muted">
          Weekly Training Volume
        </p>
        <p class="font-extrabold text-lg leading-[22px] text-white">
          {{ $t('ui.progression_over_8_weeks') }}
        </p>
      </div>
      <p class="font-bold text-sm leading-[17px] text-white text-right shrink-0">
        Peak: {{ peakLabel }}
      </p>
    </div>

    <div
      v-if="!data || !data.length"
      class="text-sm text-muted flex-1 flex items-center"
    >
      No activity data — connect Strava and sync to see volume.
    </div>

    <div
      v-else
      class="flex flex-row items-end gap-3 self-stretch w-full h-[140px]"
    >
      <div
        v-for="(d, i) in displayData"
        :key="d.label"
        class="flex flex-col justify-end items-center gap-2 self-stretch flex-1"
        :class="`order-[${i}]`"
      >
        <div class="flex flex-col justify-end items-center self-stretch h-[110px]">
          <div
            class="w-7 rounded-t-md"
            :class="[`h-[${d.height}px]`, d.active ? 'bg-primary' : 'bg-white/10']"
          ></div>
        </div>
        <p
          class="font-semibold text-label leading-label text-center"
          :class="d.active ? 'text-primary' : 'text-muted'"
        >
          {{ d.label }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import Skeleton from '@/components/ui/Skeleton.vue'
const props = defineProps({ data: { type: Array, default: () => [] }, loading: { type: Boolean, default: false } })

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
    (best, d, i) => (d.distance > (arr[best]?.distance ?? -1) ? i : best),
    0,
  )
  const maxH = 103
  const minH = 12
  return arr.map((d, i) => {
    const h = d.distance ? Math.round(Math.max(minH, (d.distance / max) * maxH)) : minH
    return { label: d.label || `W${i + 1}`, height: h, active: i === peakIdx && d.distance > 0 }
  })
})
</script>
