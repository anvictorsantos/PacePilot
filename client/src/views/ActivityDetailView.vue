<template>
  <div>
    <RouterLink to="/activities" class="text-primary text-sm hover:underline inline-flex items-center gap-1"><ArrowLeftIcon cls="w-4 h-4" /> Activities</RouterLink>
    <div v-if="loading" class="mt-4 animate-pulse h-64 bg-card rounded-2xl"></div>
    <template v-else-if="activity">
      <h1 class="text-white text-2xl font-bold mt-2">{{ activity.distance_km }} km · {{ activity.workout_type }}</h1>
      <div class="text-muted text-sm">{{ new Date(activity.date).toLocaleString() }}</div>
      <AppStats
        class="mt-6"
        :items="[
          { label: 'Distance', value: activity.distance_km + ' km' },
          { label: 'Time', value: activity.moving_time_min + ' min' },
          { label: 'Pace', value: paceLabel },
          { label: 'Elevation', value: activity.elevation_m + ' m' },
          { label: 'Avg HR', value: activity.avg_hr ? activity.avg_hr + ' bpm' : '—' },
          { label: 'Max HR', value: activity.max_hr ? activity.max_hr + ' bpm' : '—' },
          { label: 'Cadence', value: activity.avg_cadence ?? '—' },
          { label: 'Type', value: activity.workout_type },
        ]"
        :cols="4"
      />
      <div v-if="charts.length" class="mt-6 grid md:grid-cols-2 gap-4">
        <PaceChart v-for="c in charts" :key="c.title" :title="c.title" :points="c.points" labelKey="x" valueKey="y" :color="c.color" />
      </div>
      <div v-if="activity.laps && activity.laps.length" class="mt-6 bg-card border border-white/10 rounded-2xl p-5">
        <div class="text-white font-semibold text-sm mb-3">Splits / Laps</div>
        <div class="space-y-2">
          <div v-for="lap in activity.laps" :key="lap.index" class="flex justify-between text-sm border-b border-white/5 py-2">
            <span class="text-muted">Lap {{ lap.index }}</span>
            <span class="text-white">{{ (lap.distance/1000).toFixed(2) }} km · {{ Math.round(lap.moving_time/60) }} min · {{ lap.avg_heartrate ?? '—' }} bpm</span>
          </div>
        </div>
      </div>
      <div v-if="activity.analysis" class="mt-6 bg-gradient-to-br from-primary/10 to-card border border-primary/20 rounded-2xl p-5">
        <div class="text-primary text-xs tracking-widest font-semibold">COACH ANALYSIS</div>
        <p class="text-white text-sm mt-2">{{ activity.analysis }}</p>
      </div>
    </template>
    <div v-else class="text-muted mt-4">Activity not found.</div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'
import PaceChart from '../components/charts/PaceChart.vue'
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon.vue'
import AppStats from '../components/ui/AppStats.vue'
const route = useRoute(); const activity = ref(null); const loading = ref(true)
const paceLabel = computed(() => { const s = activity.value?.avg_pace_sec_km; return s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} /km` : '—' })
const charts = computed(() => {
  const s = activity.value?.streams; if (!s) return []
  const n = s.time?.length || 0; if (!n) return []
  const pts = (arr) => arr.map((y, i) => ({ x: s.time[i], y }))
  return [
    { title: 'Pace (m/s)', points: pts(s.velocity_smooth || []), color: '#F97316' },
    { title: 'Heart Rate', points: pts(s.heartrate || []), color: '#EF4444' },
    { title: 'Elevation', points: pts(s.altitude || []), color: '#22C55E' },
    { title: 'Cadence', points: pts(s.cadence || []), color: '#A1A1AA' },
  ].filter(c => c.points.length)
})
onMounted(async () => { try { const { data } = await api.get(`/activities/${route.params.id}`); activity.value = data } catch {} finally { loading.value = false } })
</script>
