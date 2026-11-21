<script lang="ts">
import { h, type PropType } from 'vue'

import { i18n } from '@/i18n'
import { formatDistanceKm, formatPlanDistance } from '@/modules/shared/ui/format.ts'
import { workoutLabel } from '@/modules/shared/ui/training-vocabulary.ts'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'

/** PlanDay plus the weekday label the week payload carries on the wire; the
 *  label is not part of the domain contract yet, so it is declared here. */
interface ScheduleDay extends PlanDay {
  day?: string | null
}

export default {
  props: {
    week: { type: Array as PropType<ScheduleDay[]>, default: () => [] },
    /** Today's session is already recorded — the row reads solid instead of muted. */
    todayCompleted: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      const week = props.week

      return h('div', { class: 'bg-card p-4.5 border border-white/10 rounded-xl' }, [
        h(
          'p',
          { class: 'mb-3.5 font-medium text-body text-primary' },
          i18n.global.t('ui.weekly_schedule'),
        ),
        h(
          'div',
          { class: 'flex flex-col' },
          week.map((entry) => {
            const isToday = !!entry.isToday
            const isCompleted = (isToday && props.todayCompleted) || entry.actual != null
            const isRest = entry.workout?.type === 'rest'
            const isSkipped = entry.workout?.status === 'skipped'
            const isDimmed = isRest || isSkipped
            const dayCls = isToday || isCompleted ? 'text-primary' : 'text-faint'
            const nameCls = isDimmed
              ? 'text-faint'
              : isToday || isCompleted
                ? 'text-primary'
                : 'text-muted'
            const kmCls = isDimmed ? 'text-faint' : 'text-primary'
            const actualKm = entry.actual?.distance_km ?? null
            const dist =
              actualKm != null
                ? formatDistanceKm(actualKm)
                : entry.workout?.distance_km != null
                  ? formatPlanDistance(entry.workout.distance_km)
                  : isRest || isSkipped
                    ? '—'
                    : ''
            const label = isSkipped
              ? i18n.global.t('ui.skipped')
              : actualKm != null && entry.actual?.workout_type
                ? workoutLabel(entry.actual.workout_type)
                : entry.workout?.type
                  ? workoutLabel(entry.workout.type)
                  : entry.workout?.label || '—'
            return h(
              'div',
              {
                class:
                  'flex items-center gap-2.5 py-[7px] border-b border-white/10 last:border-0 text-body',
                ...(entry.date != null ? { key: entry.date } : {}),
              },
              [
                h('span', { class: `w-6 shrink-0 font-mono text-caption ${dayCls}` }, entry.day ?? ''),
                h(
                  'span',
                  { class: `flex-1 min-w-0 truncate ${nameCls}` },
                  isRest ? i18n.global.t('ui.rest_day') : label,
                ),
                h(
                  'span',
                  { class: `font-mono text-label whitespace-nowrap ${kmCls}` },
                  dist || '—',
                ),
              ],
            )
          }),
        ),
      ])
    }
  },
}
</script>
