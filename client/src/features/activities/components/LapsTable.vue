<template>
  <div class="bg-card border border-white/10 rounded-2xl p-4 flex flex-col">
    <p class="font-bold text-xs uppercase tracking-widest text-muted">
      {{ $t('ui.lap_splits_detail') }}
    </p>
    <div class="h-3" />
    <div class="flex justify-between items-center py-2 border-b border-white/10">
      <span class="w-14 shrink-0 font-bold text-xs text-muted uppercase">{{ $t('ui.lap') }}</span>
      <span class="w-24 shrink-0 font-bold text-xs text-muted uppercase">{{
        $t('ui.split_dist')
      }}</span>
      <span class="w-28 shrink-0 font-bold text-xs text-muted uppercase">{{ $t('ui.pace') }}</span>
      <span class="w-28 shrink-0 font-bold text-xs text-muted uppercase">{{
        $t('ui.avg_heart_rate')
      }}</span>
      <span class="w-20 shrink-0 font-bold text-xs text-muted uppercase text-right">{{
        $t('ui.elev_gain')
      }}</span>
    </div>
    <div
      v-if="!laps?.length"
      class="py-6 text-center text-sm text-muted"
    >
      No lap data.
    </div>
    <template v-else>
      <div
        v-for="lap in laps"
        :key="lap.index"
        class="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0"
      >
        <span class="w-14 shrink-0 font-bold text-xs text-primary">{{ lap.index }}</span>
        <span class="w-24 shrink-0 font-semibold text-xs text-white">{{
          fmtDist(lap.distance)
        }}</span>
        <span class="w-28 shrink-0 font-semibold text-xs text-white">{{ fmtPace(lap) }}</span>
        <span class="w-28 shrink-0 font-semibold text-xs text-white">{{
          lap.avg_heartrate ? `${Math.round(lap.avg_heartrate)} bpm` : '—'
        }}</span>
        <span class="w-20 shrink-0 font-semibold text-xs text-muted text-right">{{
          (lap.elev ?? lap.elevation_gain) ? `+${Math.round(lap.elev ?? lap.elevation_gain)}m` : '—'
        }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { formatDistanceKm, formatLapPace as fmtPace } from '@/utils/format.js'
defineProps({ laps: { type: Array, default: () => [] } })
function fmtDist(m) {
  return formatDistanceKm(m == null ? null : m / 1000)
}
</script>
