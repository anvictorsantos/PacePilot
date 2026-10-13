<template>
  <div class="bg-card border border-white/10 rounded-2xl p-4">
    <div class="text-white font-semibold text-xs mb-3">Weekly Volume</div>
    <div v-if="!data || !data.length" class="text-muted text-sm">No data</div>
    <div v-else class="h-36"><Bar :data="chartData" :options="options" /></div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as C, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
C.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
const props = defineProps({ data: Array })
const chartData = computed(() => ({
  labels: (props.data || []).map(d => d.label),
  datasets: [{ label: 'km', data: (props.data || []).map(d => d.distance), backgroundColor: '#F97316', borderRadius: 6 }],
}))
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#A1A1AA' } },
    y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#A1A1AA' } },
  },
}
</script>
