<template>
  <div class="bg-card border border-white/10 rounded-2xl p-4">
    <div class="text-white font-semibold text-xs mb-3">{{ title }}</div>
    <div v-if="points && points.length" class="h-36"><Line :data="chartData" :options="options" /></div>
    <div v-else class="text-muted text-sm">No data</div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { Chart as C, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
C.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)
const props = defineProps({ title: { type: String, default: 'Pace' }, points: Array, labelKey: String, valueKey: String, color: { type: String, default: '#F97316' } })
const chartData = computed(() => ({
  labels: (props.points || []).map((p, i) => p[props.labelKey] ?? i),
  datasets: [{ label: props.title, data: (props.points || []).map(p => p[props.valueKey]), borderColor: props.color, backgroundColor: props.color + '20', fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 10, borderWidth: 2 }],
}))
const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      backgroundColor: '#1A1A21',
      titleColor: '#A1A1AA',
      bodyColor: '#fff',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      displayColors: false,
      padding: 10,
      callbacks: {
        title: items => items[0]?.label ?? '',
        label: ctx => {
          const v = ctx.parsed.y
          if (v == null) return ''
          const t = (props.title || '').toLowerCase()
          if (t.includes('pace') || t.includes('sec/km')) { const s = Math.round(v); return ` ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} /km` }
          if (t.includes('heart') || t.includes('hr')) return ` ${Math.round(v)} bpm`
          if (t.includes('elevation') || t.includes('altitude')) return ` ${Math.round(v)} m`
          if (t.includes('cadence')) return ` ${Math.round(v)} spm`
          return ` ${typeof v === 'number' ? Math.round(v*100)/100 : v}`
        },
      },
    },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#A1A1AA', maxTicksLimit: 6 } },
    y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#A1A1AA' } },
  },
}
</script>
