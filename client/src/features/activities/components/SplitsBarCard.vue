<template>
  <div class="bg-card border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
    <p class="font-bold text-xs uppercase tracking-widest text-muted">
      {{ $t('ui.km_splits_progress') }}
    </p>
    <div
      v-if="!splits.length"
      class="text-sm text-muted py-2"
    >
      {{ $t('ui.no_splits') }}
    </div>
    <div
      v-else
      class="flex flex-col gap-2"
    >
      <div
        v-for="s in splits"
        :key="s.km"
        class="flex justify-between items-center gap-3"
      >
        <span class="w-10 shrink-0 font-bold text-xs text-muted"
          >{{ $t('ui.km_unit') }} {{ s.km }}</span
        >
        <div class="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            class="h-2 bg-primary rounded-full"
            :class="`w-[${s.widthPct}%]`"
          />
        </div>
        <span class="w-10 shrink-0 font-bold text-xs text-white text-right">{{ s.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  laps: { type: Array, default: () => [] },
  streams: { type: Object, default: null },
  totalKm: { type: Number, default: null },
})

// prefer laps; fallback to synthesize km splits from streams or from avg pace
const splits = computed(() => {
  if (props.laps?.length) {
    // build km splits from laps (each lap may be ~1km, or aggregate)
    let dist = 0
    const out = []
    let kmIdx = 1
    for (const lap of props.laps) {
      dist += (lap.distance ?? 1000) / 1000
      while (dist >= kmIdx - 0.001) {
        // pace for this km ~ lap pace (good enough)
        const paceSec = lap.distance
          ? (lap.moving_time ?? lap.elapsed_time) / (lap.distance / 1000)
          : null
        const label = paceSec
          ? `${Math.floor(paceSec / 60)}:${String(Math.round(paceSec % 60)).padStart(2, '0')}`
          : '—'
        out.push({ km: kmIdx, label, paceSec: paceSec ?? 360 })
        kmIdx++
        if (out.length >= 6) break
      }
      if (out.length >= 6) break
    }
    // normalize widths: slower (higher paceSec) → shorter bar
    if (!out.length) return []
    const max = Math.max(...out.map((o) => o.paceSec)),
      min = Math.min(...out.map((o) => o.paceSec))
    const range = max - min || 1
    return out.map((o) => ({
      ...o,
      widthPct: Math.round(72 + (1 - (o.paceSec - min) / range) * 28),
    }))
  }
  // fallback: 5 synthetic splits around avg
  const total = props.totalKm ?? 5.2
  const n = Math.min(5, Math.ceil(total))
  return Array.from({ length: n }, (_, i) => ({
    km: i + 1,
    label: '—',
    paceSec: 340,
    widthPct: 70 + i * 3,
  }))
})
</script>
