<script lang="ts">
import { h, type PropType } from 'vue'

import { i18n } from '@/i18n'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'
import { formatPlanDistance } from '@/utils/format.ts'

/** PlanDay plus the weekday label the week payload carries on the wire; the
 *  label is not part of the domain contract yet, so it is declared here. */
interface ScheduleDay extends PlanDay {
  day?: string | null
}

// Verbatim move of the inline WeekSchedule h() component from
// TodayWorkoutView (Pass 6: extract, no visual change).
export default {
  props: { week: { type: Array as PropType<ScheduleDay[]>, default: () => [] } },
  setup(props) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return () => {
      const week = props.week
      const todayIdx = week.findIndex((e) => !!e.isToday)
      const rotatedWeek =
        todayIdx >= 0 ? [...week.slice(todayIdx), ...week.slice(0, todayIdx)] : week

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
          rotatedWeek.map((entry) => {
            const isToday = !!entry.isToday
            const isRest = entry.workout?.type === 'rest'
            const isSkipped = entry.workout?.status === 'skipped'
            const entryDate = new Date(entry.date + 'T12:00:00')
            entryDate.setHours(0, 0, 0, 0)
            const isPastDay = entryDate < today && !isToday
            const cls = isToday
              ? 'bg-primary/[0.13] border-primary'
              : isPastDay || isRest
                ? 'bg-card border-white/10 opacity-60'
                : 'bg-card border-white/10'
            const dayCls = isToday
              ? 'text-primary font-extrabold'
              : isRest || isSkipped || isPastDay
                ? 'text-white/30'
                : 'text-muted font-bold'
            const nameCls =
              isRest || isSkipped || isPastDay
                ? 'text-white/40'
                : isToday
                  ? 'text-white font-bold'
                  : 'text-white font-medium'
            const distCls = isToday
              ? 'text-primary'
              : isRest || isSkipped || isPastDay
                ? 'text-white/30'
                : 'text-muted'
            const dist =
              entry.workout?.distance_km != null
                ? formatPlanDistance(entry.workout.distance_km)
                : isRest || isSkipped
                  ? '—'
                  : ''
            const label = isSkipped
              ? i18n.global.t('ui.skipped')
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
