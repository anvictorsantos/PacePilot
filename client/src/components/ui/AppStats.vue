<template>
  <Skeleton v-if="loading" />
  <!-- Tailwind Plus — Stats / Simple with dividers (dark) — https://tailwindcss.com/plus/ui-blocks/application-ui/data-display/stats -->
  <!-- Dark-adapted: bg-white/10 outer with bg-card cells, rounded-2xl, dividers via gap -->
  <dl
    v-else
    class="grid overflow-hidden rounded-2xl bg-white/10 gap-px"
    :class="gridClass"
  >
    <div
      v-for="item in items"
      :key="item.label"
      class="flex flex-col bg-card px-5 py-5"
    >
      <dt class="text-xs tracking-widest uppercase text-muted truncate">{{ item.label }}</dt>
      <dd class="mt-2 flex items-baseline gap-x-2 flex-wrap">
        <span class="text-xl font-bold tracking-tight text-white">{{ item.value }}</span>
        <span v-if="item.sub" class="text-xs text-muted">{{ item.sub }}</span>
      </dd>
      <dd v-if="item.trend" class="mt-1 text-xs" :class="trendClass(item.trend)">
        {{ item.trend }}
      </dd>
    </div>
  </dl>
</template>

<script setup>
import { computed } from 'vue'
import Skeleton from '@/components/ui/Skeleton.vue'

const props = defineProps({
  items: { type: Array, required: false, default: () => [] }, // [{ label, value, sub?, trend? }]
  cols: { type: Number, default: 4 }, // 2 | 3 | 4
  loading: { type: Boolean, default: false },
})

const gridClass = computed(() => {
  const map = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  }
  return map[props.cols] || map[4]
})

function trendClass(trend) {
  if (!trend) return ''
  // primary for positive/building, muted otherwise — keep minimal
  if (/building|up|\+/i.test(trend)) return 'text-success'
  if (/reducing|down|-/i.test(trend)) return 'text-warning'
  return 'text-muted'
}
</script>
