<template>
  <div class="min-w-0">
    <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-2 [&>*]:min-w-0">
      <div
        v-for="d in week"
        :key="d.date ?? d.day ?? ''"
        class="flex flex-col gap-1 p-3 border rounded-[10px] min-h-[172px]"
        :class="
          isToday(d)
            ? 'border-white/20 bg-cardSecondary'
            : isRest(d)
              ? 'border-dashed border-white/10 bg-transparent'
              : 'border-white/10 bg-card'
        "
        :aria-current="isToday(d) ? 'date' : undefined"
      >
        <span
          class="font-mono text-caption"
          :class="isToday(d) ? 'text-primary' : 'text-faint'"
          >{{ d.day ?? '' }}</span
        >
        <span
          class="mb-2 text-label"
          :class="isToday(d) ? 'text-primary' : 'text-faint'"
          >{{ fmtShort(d.date) }}</span
        >
        <span
          class="text-body leading-snug"
          :class="isRest(d) ? 'text-faint' : 'text-primary'"
          >{{ isRest(d) ? $t('ui.rest_day') : displayBadge(d) }}</span
        >
        <span
          v-if="plannedNote(d)"
          class="text-caption text-faint"
          >{{ plannedNote(d) }}</span
        >
        <span class="mt-auto font-mono text-body text-muted">{{ displayDistance(d) }}</span>
        <span
          v-if="!isRest(d)"
          class="flex h-[5px] gap-0.5 mt-2.5"
          aria-hidden="true"
        >
          <i
            class="block flex-1 h-full rounded-sm"
            :class="isCompleted(d) ? 'bg-primary' : isQuality(d) ? 'bg-accent' : 'bg-[#2c2c34]'"
          ></i>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatDistanceKm, formatPlanDistance } from '@/modules/shared/ui/format.ts'
import { workoutLabel } from '@/modules/shared/ui/training-vocabulary.ts'
import { isNonTrainingWorkout } from '@/modules/training/domain/value-object/WorkoutType.ts'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'
import type { PlanWorkout } from '@/modules/training/infrastructure/dto/PlanWorkout.ts'

/** PlanDay plus the weekday label the wire carries; not in the domain contract yet. */
interface ScheduleDay extends PlanDay {
  day?: string | null
}

const props = defineProps({
  week: { type: Array as PropType<ScheduleDay[]>, required: true },
  weekLabel: { type: String, required: true },
  /** Today's session is recorded — the today card reads solid, not accent. */
  todayCompleted: { type: Boolean, default: false },
})

const { locale, t } = useI18n()

function fmtShort(dateStr: string | null | undefined) {
  const d = new Date((dateStr ?? '') + 'T12:00:00')
  return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
}
function isRest(d: ScheduleDay) {
  return isNonTrainingWorkout(d.workout?.type)
}
function distanceText(w: PlanWorkout | null | undefined) {
  return formatPlanDistance(w?.distance_km)
}
/** A completed day shows the distance actually run; the plan stays underneath as a note. */
function displayDistance(d: ScheduleDay) {
  return d.actual?.distance_km != null
    ? formatDistanceKm(d.actual.distance_km)
    : distanceText(d.workout)
}
function displayBadge(d: ScheduleDay) {
  return workoutLabel(d.actual?.distance_km != null ? d.actual.workout_type : d.workout?.type)
}
function plannedNote(d: ScheduleDay) {
  if (d.actual?.distance_km == null) return ''
  const planned = d.workout?.distance_km
  if (planned == null || planned === d.actual.distance_km) return ''
  return t('ui.planned_distance', { km: formatPlanDistance(planned) })
}
function isCompleted(d: ScheduleDay) {
  return (d.isToday && props.todayCompleted) || d.actual != null
}
function isToday(d: ScheduleDay) {
  return !!d.isToday
}
function isQuality(d: ScheduleDay) {
  const type = d.workout?.type
  return type === 'tempo' || type === 'interval' || type === 'intervals' || type === 'threshold'
}
</script>
