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
  datasets: [{ label: props.title, data: (props.points || []).map(p => p[props.valueKey]), borderColor: props.color, backgroundColor: props.color + '20', fill: true, tension: 0.35, pointRadius: 0 }],
}))
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#A1A1AA', maxTicksLimit: 6 } },
    y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#A1A1AA' } },
  },
}
</script>
