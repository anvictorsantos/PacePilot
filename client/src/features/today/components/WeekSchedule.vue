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
    /** Today's session is already recorded — the row reads green instead of orange. */
    todayCompleted: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      const week = props.week

      return h('div', { class: 'flex flex-col gap-2' }, [
        h(
          'p',
          {
            class: 'font-bold text-muted text-label uppercase tracking-widest',
          },
          i18n.global.t('ui.weekly_schedule'),
        ),
        h(
          'div',
          { class: 'flex flex-col gap-1.5' },
          week.map((entry) => {
            const isToday = !!entry.isToday
            const isCompleted = (isToday && props.todayCompleted) || entry.actual != null
            const isRest = entry.workout?.type === 'rest'
            const isSkipped = entry.workout?.status === 'skipped'
            const isDimmed = isRest || isSkipped
            const cls = isCompleted
              ? 'bg-success/[0.12] border-success opacity-100'
              : isToday
                ? 'bg-primary/[0.13] border-primary opacity-100'
                : isDimmed
                  ? 'bg-card border-white/10 opacity-60'
                  : 'bg-card border-white/10 opacity-100'
            const dayCls = isCompleted
              ? 'text-success font-extrabold'
              : isToday
                ? 'text-primaryBright font-extrabold'
                : isDimmed
                  ? 'text-white/30'
                  : 'text-muted font-bold'
            const nameCls = isDimmed
              ? 'text-white/40'
              : isToday
                ? 'text-white font-bold'
                : 'text-white font-medium'
            const distCls = isCompleted
              ? 'text-success'
              : isToday
                ? 'text-primaryBright'
                : isDimmed
                  ? 'text-white/30'
                  : 'text-muted'
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
                : entry.workout?.label || entry.workout?.type || '—'
            return h(
              'div',
              {
                class: `flex items-center justify-between p-2.5 rounded-card border text-xs ${cls}`,
                ...(entry.date != null ? { key: entry.date } : {}),
              },
              [
                h('div', { class: 'flex items-center gap-3' }, [
                  h('p', { class: `w-8 font-bold text-label ${dayCls}` }, entry.day ?? ''),
                  h(
                    'p',
                    { class: `text-xs whitespace-nowrap ${nameCls}` },
                    isRest ? i18n.global.t('ui.rest_day') : label,
                  ),
                ]),
                h(
                  'p',
                  {
                    class: `font-semibold text-xs whitespace-nowrap ${distCls}`,
                  },
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
