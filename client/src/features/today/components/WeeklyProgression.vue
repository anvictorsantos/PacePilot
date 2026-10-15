<script>
import { computed, h } from 'vue'

import { i18n } from '@/i18n'

// Verbatim move of the inline WeeklyProgression h() component from
// TodayWorkoutView (Pass 6: extract, no visual change).
export default {
  props: { series: { type: Array, default: () => [] }, activeIndex: { type: Number, default: 0 } },
  setup(props) {
    const max = computed(() => Math.max(1, ...props.series.map((s) => s.distance)))
    const peak = computed(
      () =>
        `${Math.max(...props.series.map((s) => s.distance), 0).toFixed(1)} km ${i18n.global.t('ui.peak')}`,
    )
    return () =>
      h(
        'div',
        {
          class: 'bg-card border border-white/10 rounded-2xl p-4 flex flex-col gap-3',
        },
        [
          h('div', { class: 'flex items-center justify-between' }, [
            h(
              'p',
              {
                class: 'font-bold text-muted text-label uppercase tracking-widest',
              },
              i18n.global.t('ui.weekly_progression'),
            ),
            h('p', { class: 'font-bold text-white text-body' }, peak.value),
          ]),
          h(
            'div',
            { class: 'flex gap-1.5 h-[70px] items-end justify-center' },
            props.series.map((s, i) => {
              const height = Math.max(6, Math.round((s.distance / max.value) * 50))
              const active = i === props.activeIndex
              return h(
                'div',
                {
                  class: 'flex-1 min-w-0 flex flex-col gap-1 items-center',
                  key: s.label,
                },
                [
                  h(
                    'div',
                    {
                      class: 'flex flex-col items-center justify-end w-full h-[50px]',
                    },
                    [
                      h('div', {
                        class: `w-3 rounded-t-[4px] transition-all h-[${height}px] ${active ? 'bg-primary' : 'bg-white/10'}`,
                      }),
                    ],
                  ),
                  h(
                    'p',
                    {
                      class: `font-semibold text-micro leading-none ${active ? 'text-primary' : 'text-muted'}`,
                    },
                    s.label,
                  ),
                ],
              )
            }),
          ),
        ],
      )
  },
}
</script>
