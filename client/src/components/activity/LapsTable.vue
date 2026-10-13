<template>
  <div class="bg-card border border-white/10 rounded-2xl p-4 flex flex-col">
    <p class="font-bold text-xs uppercase tracking-widest text-muted">Lap Splits Detail</p>
    <div class="h-3" />
    <div class="flex justify-between items-center py-2 border-b border-white/10">
      <span class="w-14 shrink-0 font-bold text-xs text-muted uppercase">LAP</span>
      <span class="w-24 shrink-0 font-bold text-xs text-muted uppercase">SPLIT DIST</span>
      <span class="w-28 shrink-0 font-bold text-xs text-muted uppercase">PACE</span>
      <span class="w-28 shrink-0 font-bold text-xs text-muted uppercase">AVG HEART RATE</span>
      <span class="w-20 shrink-0 font-bold text-xs text-muted uppercase text-right">ELEV GAIN</span>
    </div>
    <div v-if="!laps?.length" class="py-6 text-center text-sm text-muted">No lap data.</div>
    <template v-else>
      <div
        v-for="lap in laps"
        :key="lap.index"
        class="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0"
      >
        <span class="w-14 shrink-0 font-bold text-xs text-primary">{{ lap.index }}</span>
        <span class="w-24 shrink-0 font-semibold text-xs text-white">{{ fmtDist(lap.distance) }}</span>
        <span class="w-28 shrink-0 font-semibold text-xs text-white">{{ fmtPace(lap) }}</span>
        <span class="w-28 shrink-0 font-semibold text-xs text-white">{{ lap.avg_heartrate ? `${Math.round(lap.avg_heartrate)} bpm` : '—' }}</span>
        <span class="w-20 shrink-0 font-semibold text-xs text-muted text-right">{{ lap.elev ?? lap.elevation_gain ? `+${Math.round(lap.elev ?? lap.elevation_gain)}m` : '—' }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({ laps: { type: Array, default: () => [] } })
function fmtDist(m) { if(m==null) return '—'; return `${(m/1000).toFixed(1)} km` }
function fmtPace(lap) {
  const d = lap.distance ?? 0; const t = lap.moving_time ?? lap.elapsed_time ?? 0
  if (!d || !t) return '—'
  const secPerKm = t / (d/1000)
  const m = Math.floor(secPerKm/60); const s = Math.round(secPerKm%60)
  return `${m}:${String(s).padStart(2,'0')} /km`
}
</script>
