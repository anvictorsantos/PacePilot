<template>
  <div class="space-y-6">
    <h1 class="text-white text-2xl font-bold">Progress</h1>
    <AppStats
      :items="data ? [
        { label: 'Total Distance', value: data.totalDistance + ' km' },
        { label: 'Activities', value: String(data.totalActivities) },
        { label: 'Trend', value: data.trainingState.trend, sub: '' },
        { label: 'Long Run', value: data.trainingState.weekly.longRun28 + ' km', sub: '28-day best' },
      ] : []"
      :cols="4"
      :loading="loading" />
    <WeeklyVolumeChart :data="data?.volumeSeries || []" :loading="loading" />
    <div class="grid md:grid-cols-2 gap-4">
      <PaceChart title="Pace Trend (sec/km)" :points="pacePoints" labelKey="label" valueKey="pace" color="#F97316" :loading="loading" />
      <PaceChart title="Heart Rate Trend" :points="pacePoints" labelKey="label" valueKey="hr" color="#EF4444" :loading="loading" />
    </div>
    <template v-if="data">
      <div v-if="data.trainingState.fatigueSignals.length" class="bg-warning/10 border border-warning/30 rounded-2xl p-5">
        <div class="text-warning text-xs tracking-widest font-semibold">FATIGUE SIGNALS</div>
        <ul class="mt-2 space-y-1"><li v-for="(s,i) in data.trainingState.fatigueSignals" :key="i" class="text-white text-sm flex gap-2 items-start"><ChevronRightIcon cls="w-4 h-4 shrink-0 mt-0.5 text-warning" /> {{ s }}</li></ul>
      </div>
      <div class="bg-card border border-white/10 rounded-2xl p-5">
        <div class="text-white font-semibold text-sm mb-3">Best Efforts</div>
        <div v-for="r in data.records" :key="r.id" class="flex justify-between text-sm py-2 border-b border-white/5">
          <span class="text-muted">{{ new Date(r.date).toLocaleDateString() }} · {{ r.distance_km }} km</span>
          <span class="text-white font-semibold">{{ Math.floor(r.pace/60) }}:{{ String(r.pace%60).padStart(2,'0') }} /km</span>
        </div>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api.js'
import WeeklyVolumeChart from '@/components/charts/WeeklyVolumeChart.vue'
import PaceChart from '@/components/charts/PaceChart.vue'
import ChevronRightIcon from '@/components/icons/ChevronRightIcon.vue'
import AppStats from '@/components/ui/AppStats.vue'
const data = ref(null); const loading = ref(true)
const pacePoints = computed(() => (data.value?.paceSeries || []).map((p, i) => ({ label: `Run ${i+1}`, pace: p.pace, hr: p.hr })))
onMounted(async () => { try { const { data: d } = await api.get('/progress'); data.value = d } catch {} finally { loading.value = false } })
</script>
