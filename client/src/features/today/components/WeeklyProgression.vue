<script lang="ts">
import { computed, h, type PropType } from 'vue'

import { i18n } from '@/i18n'
import type { VolumePoint } from '@/modules/progress/infrastructure/dto/VolumePoint.ts'

export default {
  props: {
    series: { type: Array as PropType<VolumePoint[]>, default: () => [] },
    activeIndex: { type: Number, default: 0 },
  },
  setup(props) {
    const max = computed(() => Math.max(1, ...props.series.map((s) => s.distance ?? 0)))
    const peak = computed(
      () =>
        `${Math.max(...props.series.map((s) => s.distance ?? 0), 0).toFixed(1)} km ${i18n.global.t('ui.peak')}`,
    )
    return () =>
      h('div', { class: 'bg-card border border-white/10 rounded-xl p-4.5' }, [
        h('div', { class: 'flex items-baseline justify-between mb-3' }, [
          h(
            'p',
            { class: 'font-medium text-body text-primary' },
            i18n.global.t('ui.weekly_progression'),
          ),
          h('p', { class: 'font-mono text-label text-muted' }, peak.value),
        ]),
        h(
          'div',
          { class: 'flex items-end gap-[3px] h-[46px]' },
          props.series.map((s, i) => {
            const height = Math.max(6, Math.round(((s.distance ?? 0) / max.value) * 100))
            const active = i === props.activeIndex
            return h('div', {
              class: `flex-1 rounded-t-sm transition-all ${active ? 'bg-primary' : 'bg-[#2a2a32]'}`,
              style: { height: `${height}%` },
              ...(s.label != null ? { key: s.label } : {}),
            })
          }),
        ),
        h(
          'div',
          { class: 'flex justify-between mt-[7px] font-mono text-caption text-faint' },
          props.series.map((s, i) =>
            h('span', { class: i === props.activeIndex ? 'text-primary' : '' }, s.label ?? ''),
          ),
        ),
      ])
  },
}
</script>
