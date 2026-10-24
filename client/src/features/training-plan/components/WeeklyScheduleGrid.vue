<template>
  <div class="flex flex-col gap-3 min-w-0">
    <p class="font-bold text-label text-muted uppercase tracking-widest">{{ weekLabel }}</p>

    <div class="flex gap-2.5 -mx-1 px-1 pb-1 overflow-x-auto">
      <DayCard
        v-for="d in week"
        :key="d.date ?? d.day ?? ''"
        size="sm"
        layout="column"
        :day-label="d.day ?? ''"
        :date="fmtShort(d.date)"
        :dist="displayDistance(d)"
        :today="!!d.isToday"
        :completed="isCompleted(d)"
        :rest="isDimmed(d)"
      >
        <template #body>
          <!-- col-body -->
          <div class="flex flex-col gap-2">
            <span
              class="inline-flex self-start px-1.5 py-0.5 rounded font-extrabold text-micro uppercase leading-none tracking-wide"
              :class="
                isCompleted(d)
                  ? 'bg-success/10 text-success'
                  : isRest(d) && !d.isToday
                    ? 'bg-white/[0.06] text-muted'
                    : 'bg-primary/10 text-primary'
              "
              >{{ displayBadge(d) }}</span
            >
            <p
              class="font-black text-title leading-none"
              :class="isCompleted(d) ? 'text-success' : 'text-white'"
            >
              {{ displayDistance(d) }}
            </p>
            <p
              v-if="plannedNote(d)"
              class="font-normal text-caption text-muted leading-none"
            >
              {{ plannedNote(d) }}
            </p>
          </div>

          <!-- col-footer -->
          <template v-if="isRest(d)">
            <p class="font-normal text-label text-muted">{{ $t('ui.recovery_focus') }}</p>
          </template>
          <template v-else-if="!d.actual">
            <div class="flex flex-col gap-1 font-normal text-label text-muted">
              <p>
                {{ $t('ui.target_label') }}
                <span class="font-semibold text-white">{{ targetFor(d.workout?.type).pace }}</span>
              </p>
              <p>{{ $t('ui.rpe') }} {{ targetFor(d.workout?.type).rpe }}</p>
            </div>
          </template>

          <!-- programme role: deterministic, computed server-side -->
          <p
            v-if="d.programmeRole && !d.actual"
            class="font-semibold text-caption text-primary uppercase tracking-wide"
          >
            {{ d.programmeRole }}
          </p>

          <!-- AI explanation -->
          <p
            v-if="d.workout?.aiExplanation"
            class="font-normal text-caption text-muted leading-relaxed"
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
              class="inline-flex px-2 py-0.5 rounded font-black text-micro text-white uppercase"
              :class="isCompleted(d) ? 'bg-success' : 'bg-primary'"
              >{{ $t('ui.today') }}</span
            >
          </div>
        </template>
      </DayCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import DayCard from '@/components/ui/DayCard.vue'
import { formatDistanceKm, formatPlanDistance } from '@/modules/shared/ui/format.ts'
import { workoutBadge, workoutTarget } from '@/modules/shared/ui/training-vocabulary.ts'
import { isNonTrainingWorkout } from '@/modules/training/domain/value-object/WorkoutType.ts'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'
import type { PlanWorkout } from '@/modules/training/infrastructure/dto/PlanWorkout.ts'

/** PlanDay plus the weekday label the week payload carries on the wire; the
 *  label is not part of the domain contract yet, so it is declared here. */
interface ScheduleDay extends PlanDay {
  day?: string | null
}

const props = defineProps({
  week: { type: Array as PropType<ScheduleDay[]>, required: true },
  weekLabel: { type: String, required: true },
  /** Today's session is recorded — the today card reads green, not orange. */
  todayCompleted: { type: Boolean, default: false },
})

const { locale, t } = useI18n()

function fmtShort(dateStr: string | null | undefined) {
  const d = new Date((dateStr ?? '') + 'T12:00:00')
  return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
}
function badgeLabel(type: string | null | undefined) {
  return workoutBadge(type)
}
function targetFor(type: string | null | undefined) {
  return workoutTarget(type)
}
function isRest(d: ScheduleDay) {
  return isNonTrainingWorkout(d.workout?.type)
}
function distanceText(w: PlanWorkout | null | undefined) {
  return formatPlanDistance(w?.distance_km)
}
/** A completed day shows the distance actually run; the plan stays underneath
 *  as a small note so the prescription is never lost. */
function displayDistance(d: ScheduleDay) {
  return d.actual?.distance_km != null
    ? formatDistanceKm(d.actual.distance_km)
    : distanceText(d.workout)
}
function displayBadge(d: ScheduleDay) {
  return badgeLabel(d.actual?.distance_km != null ? d.actual.workout_type : d.workout?.type)
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
function isDimmed(d: ScheduleDay) {
  return d.workout?.status === 'skipped' || isRest(d)
}
</script>
