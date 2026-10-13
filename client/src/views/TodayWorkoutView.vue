<template>
  <div class="max-w-2xl">
    <div class="text-primary text-xs tracking-widest font-semibold">TODAY'S WORKOUT</div>
    <div v-if="loading" class="mt-4 animate-pulse h-64 bg-card rounded-2xl"></div>
    <template v-else-if="data">
      <h1 class="text-white text-3xl font-bold mt-2 uppercase">{{ data.recommendation.type }}</h1>
      <div class="text-white/60 mt-1">{{ data.recommendation.distance_km }} KM · {{ data.recommendation.duration_min }} min · {{ data.recommendation.intensity }}</div>
      <div class="mt-6 bg-card border border-white/10 rounded-2xl p-6 space-y-5">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><div class="text-muted text-xs uppercase tracking-widest">Target Pace</div><div class="text-white font-semibold mt-1">{{ data.recommendation.target_pace }}</div></div>
          <div><div class="text-muted text-xs uppercase tracking-widest">Target HR</div><div class="text-white font-semibold mt-1">{{ data.recommendation.target_hr }}</div></div>
        </div>
        <div>
          <div class="text-muted text-xs uppercase tracking-widest">Warm Up</div>
          <div class="text-white text-sm mt-1">{{ data.recommendation.warmup }}</div>
        </div>
        <div>
          <div class="text-muted text-xs uppercase tracking-widest">Main Set</div>
          <div class="text-white text-sm mt-1">{{ data.recommendation.main_set }}</div>
        </div>
        <div>
          <div class="text-muted text-xs uppercase tracking-widest">Cool Down</div>
          <div class="text-white text-sm mt-1">{{ data.recommendation.cooldown }}</div>
        </div>
        <div class="pt-4 border-t border-white/10">
          <div class="text-muted text-xs uppercase tracking-widest">Why This Workout?</div>
          <p class="text-white text-sm mt-2">{{ data.recommendation.purpose }}</p>
          <ul class="mt-3 space-y-1">
            <li v-for="(r,i) in data.reasons" :key="i" class="text-muted text-sm flex gap-2 items-start"><ChevronRightIcon cls="w-4 h-4 shrink-0 mt-0.5 text-primary" /> {{ r }}</li>
          </ul>
        </div>
        <div class="bg-primary/10 border border-primary/20 rounded-xl p-4">
          <div class="text-primary text-xs font-semibold">If legs feel unusually heavy</div>
          <div class="text-white text-sm mt-1">{{ data.recommendation.alternative }}</div>
        </div>
      </div>
    </template>
    <div v-else class="text-muted mt-4">No workout available.</div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api.js'
import ChevronRightIcon from '../components/icons/ChevronRightIcon.vue'
const data = ref(null); const loading = ref(true)
onMounted(async () => { try { const { data: d } = await api.get('/plan/today'); data.value = d } catch {} finally { loading.value = false } })
</script>
