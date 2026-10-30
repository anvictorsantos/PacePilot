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
        <div class="flex-1">
          <ProgressBar
            :pct="s.widthPct"
            :label="s.label"
            size="md"
          />
        </div>
        <span class="w-10 shrink-0 font-bold text-xs text-white text-right">{{ s.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

import ProgressBar from '@/components/ui/ProgressBar.vue'
import type { ActivityStreams } from '@/modules/activities/infrastructure/dto/ActivityStreams.ts'
import type { Lap } from '@/modules/activities/infrastructure/dto/Lap.ts'

const props = defineProps({
  laps: { type: Array as PropType<Lap[]>, default: () => [] },
  streams: { type: Object as PropType<ActivityStreams | null>, default: null },
})

const MAX_SPLITS = 6

interface Split {
  km: number
  label: string
  paceSec: number
  widthPct: number
}

interface StreamPoint {
  distanceM: number
  timeS: number | null
  speedMps: number | null
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatPace(sec: number): string {
  const total = Math.round(sec)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Align distance with time/velocity, dropping the samples with no distance. */
function streamPoints(streams: ActivityStreams | null): StreamPoint[] {
  const distances = streams?.distance ?? []
  const times = streams?.time ?? []
  const speeds = streams?.velocity_smooth ?? []
  const points: StreamPoint[] = []
  for (let i = 0; i < distances.length; i += 1) {
    const distanceM = finite(distances[i])
    if (distanceM == null) continue
    points.push({ distanceM, timeS: finite(times[i]), speedMps: finite(speeds[i]) })
  }
  const first = points[0]
  if (first && first.timeS == null && first.speedMps && first.speedMps > 0) first.timeS = 0
  for (let i = 1; i < points.length; i += 1) {
    const current = points[i]
    const previous = points[i - 1]
    if (!current || !previous || current.timeS != null || previous.timeS == null) continue
    if (current.speedMps && current.speedMps > 0 && current.distanceM > previous.distanceM)
      current.timeS = previous.timeS + (current.distanceM - previous.distanceM) / current.speedMps
  }
  return points
}

/** Interpolate the elapsed seconds at a distance inside the stream. */
function timeAtDistance(points: StreamPoint[], target: number): number | null {
  const first = points[0]
  if (!first) return null
  if (target <= first.distanceM) return first.timeS
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]
    const current = points[i]
    if (!previous || !current || current.distanceM < target) continue
    if (previous.timeS == null || current.timeS == null) return null
    if (current.distanceM === previous.distanceM) return current.timeS
    const ratio = (target - previous.distanceM) / (current.distanceM - previous.distanceM)
    return previous.timeS + ratio * (current.timeS - previous.timeS)
  }
  return null
}

/** Slower km gets the shorter bar; a steady run keeps every bar full. */
function withWidths(splits: Array<Omit<Split, 'widthPct'>>): Split[] {
  if (!splits.length) return []
  const paces = splits.map((split) => split.paceSec)
  const max = Math.max(...paces)
  const min = Math.min(...paces)
  const range = max - min
  return splits.map((split) => ({
    ...split,
    widthPct: range > 0 ? Math.round(72 + (1 - (split.paceSec - min) / range) * 28) : 100,
  }))
}

/** Real per-km splits from the distance/time streams, not one lap repeated. */
function splitsFromStreams(streams: ActivityStreams | null): Array<Omit<Split, 'widthPct'>> {
  const points = streamPoints(streams)
  const totalM = points[points.length - 1]?.distanceM ?? 0
  const fullKms = Math.min(MAX_SPLITS, Math.floor(totalM / 1000))
  const splits: Array<Omit<Split, 'widthPct'>> = []
  for (let km = 1; km <= fullKms; km += 1) {
    const start = timeAtDistance(points, (km - 1) * 1000)
    const end = timeAtDistance(points, km * 1000)
    if (start == null || end == null) continue
    const paceSec = end - start
    if (!Number.isFinite(paceSec) || paceSec <= 0) continue
    splits.push({ km, paceSec, label: formatPace(paceSec) })
  }
  return splits
}

/** Fallback for an activity with no streams: one bar per lap, never per fake km. */
function splitsFromLaps(laps: Lap[]): Array<Omit<Split, 'widthPct'>> {
  const splits: Array<Omit<Split, 'widthPct'>> = []
  for (const [index, lap] of laps.entries()) {
    const distanceKm = (finite(lap.distance) ?? 0) / 1000
    const movingTime = finite(lap.moving_time)
    const paceSec =
      finite(lap.avg_pace_sec_km) ??
      (distanceKm > 0 && movingTime != null ? movingTime / distanceKm : null)
    if (paceSec == null || !Number.isFinite(paceSec) || paceSec <= 0) continue
    splits.push({ km: index + 1, paceSec, label: formatPace(paceSec) })
    if (splits.length >= MAX_SPLITS) break
  }
  return splits
}

const splits = computed<Split[]>(() => {
  const fromStreams = splitsFromStreams(props.streams)
  return withWidths(fromStreams.length ? fromStreams : splitsFromLaps(props.laps ?? []))
})
</script>
