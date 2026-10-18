<template>
  <div class="flex flex-col gap-3">
    <p class="text-label font-bold uppercase tracking-widest text-muted">{{ weekLabel }}</p>

    <div class="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible">
      <div
        v-for="d in rotatedWeek"
        :key="d.date"
        class="flex min-w-[124px] flex-1 flex-col gap-4 rounded-2xl p-4 sm:min-w-0"
        :class="cardClass(d)"
      >
        <!-- col-header -->
        <div class="flex flex-col gap-0.5">
          <p
            class="text-sm font-extrabold leading-none"
            :class="
              d.isToday
                ? 'text-primary'
                : d.workout.status === 'skipped' || isRest(d) || isPastDay(d)
                  ? 'text-white/30'
                  : 'text-white'
            "
          >
            {{ d.day }}
          </p>
          <p class="text-label font-normal text-muted">{{ fmtShort(d.date) }}</p>
        </div>

        <div class="h-px w-full bg-white/10"></div>

        <!-- col-body -->
        <div class="flex flex-col gap-2">
          <span
            class="inline-flex self-start rounded px-1.5 py-0.5 text-micro font-extrabold uppercase leading-none tracking-wide"
            :class="isRest(d) ? 'bg-white/[0.06] text-muted' : 'bg-primary/10 text-primary'"
            >{{ badgeLabel(d.workout.type) }}</span
          >
          <p class="text-title font-black leading-none text-white">{{ distanceText(d.workout) }}</p>
        </div>

        <!-- col-footer -->
        <template v-if="isRest(d)">
          <p class="text-label font-normal text-muted">{{ $t('ui.recovery_focus') }}</p>
        </template>
        <template v-else>
          <div class="flex flex-col gap-1 text-label font-normal text-muted">
            <p>
              {{ $t('ui.target_label') }}
              <span class="font-semibold text-white">{{ targetFor(d.workout.type).pace }}</span>
            </p>
            <p>{{ $t('ui.rpe') }} {{ targetFor(d.workout.type).rpe }}</p>
          </div>
        </template>

        <!-- programme role: deterministic, computed server-side -->
        <p
          v-if="d.programmeRole"
          class="text-caption font-semibold text-primary uppercase tracking-wide"
        >
          {{ d.programmeRole }}
        </p>

        <!-- AI explanation -->
        <p
          v-if="d.workout?.aiExplanation"
          class="text-caption font-normal leading-relaxed text-muted"
        >
          <span class="font-semibold text-white">{{ $t('ui.caption') }}</span>
          {{ d.workout.aiExplanation }}
        </p>

        <!-- today-marker -->
        <div
          v-if="d.isToday"
          class="mt-auto"
        >
          <span
            class="inline-flex rounded bg-primary px-2 py-0.5 text-micro font-black uppercase text-white"
            >{{ $t('ui.today') }}</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatPlanDistance } from '@/utils/format.ts'
import { workoutBadge, workoutTarget } from '@/utils/training-vocabulary.ts'

const props = defineProps({
  week: { type: Array, required: true },
  weekLabel: { type: String, required: true },
})

const { locale } = useI18n()

const today = new Date()
today.setHours(0, 0, 0, 0)

const rotatedWeek = computed(() => {
  const week = props.week
  const todayIdx = week.findIndex((e) => !!e.isToday)
  return todayIdx >= 0 ? [...week.slice(todayIdx), ...week.slice(0, todayIdx)] : week
})

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
}
function badgeLabel(type) {
  return workoutBadge(type)
}
function targetFor(type) {
  return workoutTarget(type)
}
function isRest(d) {
  return d.workout.type === 'rest' || d.workout.type === 'unknown'
}
function distanceText(w) {
  return formatPlanDistance(w?.distance_km)
}
function isPastDay(d) {
  const entryDate = new Date(d.date + 'T12:00:00')
  entryDate.setHours(0, 0, 0, 0)
  return entryDate < today && !d.isToday
}
function cardClass(d) {
  if (d.isToday) return 'bg-[rgba(249,115,22,0.13)] border-2 border-primary'
  if (d.workout.status === 'skipped' || isRest(d) || isPastDay(d))
    return 'bg-card border border-white/10 opacity-60'
  return 'bg-card border border-white/10'
}
</script>
