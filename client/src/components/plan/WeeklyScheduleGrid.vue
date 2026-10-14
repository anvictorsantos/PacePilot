<template>
  <div class="flex flex-col gap-3">
    <p class="text-label font-bold uppercase tracking-widest text-muted">{{ weekLabel }}</p>

    <div class="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible">
      <div
        v-for="d in week"
        :key="d.date"
        class="flex min-w-[124px] flex-1 flex-col gap-4 rounded-2xl p-4 sm:min-w-0"
        :class="cardClass(d)"
      >
        <!-- col-header -->
        <div class="flex flex-col gap-0.5">
          <p class="text-sm font-extrabold leading-none" :class="d.isToday ? 'text-primary' : 'text-white'">{{ d.day }}</p>
          <p class="text-label font-normal text-muted">{{ fmtShort(d.date) }}</p>
        </div>

        <div class="h-px w-full bg-white/10"></div>

        <!-- col-body -->
        <div class="flex flex-col gap-2">
          <span
            class="inline-flex self-start rounded px-1.5 py-0.5 text-micro font-extrabold uppercase leading-none tracking-wide"
            :class="isRest(d) ? 'bg-white/[0.06] text-muted' : 'bg-primary/10 text-primary'"
          >{{ badgeLabel(d.workout.type) }}</span>
          <p class="text-title font-black leading-none text-white">{{ distanceText(d.workout) }}</p>
        </div>

        <!-- col-footer -->
        <template v-if="isRest(d)">
          <p class="text-label font-normal text-muted">Recovery focus</p>
        </template>
        <template v-else>
          <div class="flex flex-col gap-1 text-label font-normal text-muted">
            <p>Target: <span class="font-semibold text-white">{{ targetFor(d.workout.type).pace }}</span></p>
            <p>RPE {{ targetFor(d.workout.type).rpe }}</p>
          </div>
        </template>

        <!-- today-marker -->
        <div v-if="d.isToday" class="mt-auto">
          <span class="inline-flex rounded bg-primary px-2 py-0.5 text-micro font-black uppercase text-white">TODAY</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  week: { type: Array, required: true },
  weekLabel: { type: String, required: true },
})

const BADGE_MAP = {
  rest: 'REST DAY',
  recovery: 'RECOVERY',
  tempo: 'TEMPO RUN',
  easy: 'EASY RUN',
  long: 'LONG RUN',
  interval: 'INTERVALS',
  intervals: 'INTERVALS',
  steady: 'STEADY RUN',
  threshold: 'THRESHOLD',
}

const TARGET_MAP = {
  recovery: { pace: '5:50/km', rpe: 4 },
  easy: { pace: '6:00/km', rpe: 3 },
  long: { pace: '5:40/km', rpe: 5 },
  steady: { pace: '5:25/km', rpe: 6 },
  tempo: { pace: '5:15/km', rpe: 7 },
  threshold: { pace: '5:00/km', rpe: 7 },
  interval: { pace: '4:55/km', rpe: 8 },
  intervals: { pace: '4:55/km', rpe: 8 },
  rest: { pace: '—', rpe: '—' },
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function badgeLabel(type) { return BADGE_MAP[type] || String(type || '').toUpperCase() }
function targetFor(type) { return TARGET_MAP[type] || TARGET_MAP.easy }
function isRest(d) { return d.workout.type === 'rest' || d.workout.type === 'unknown' }
function distanceText(w) {
  if (!w.distance) return '—'
  return String(w.distance).replace(/\s*KM\s*/i, ' km')
}
function cardClass(d) {
  if (d.isToday) return 'bg-[rgba(249,115,22,0.13)] border-2 border-primary'
  if (d.workout.status === 'skipped' || isRest(d)) return 'bg-card border border-white/10 opacity-60'
  return 'bg-card border border-white/10'
}
</script>
