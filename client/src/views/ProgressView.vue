<template>
  <div class="flex flex-col gap-6">
    <!-- header-block — matches TrainingPlan 9:717: 11px muted + 32px black -->
    <div class="flex flex-col gap-1">
      <p class="text-[11px] font-bold uppercase tracking-widest text-muted">Your Journey</p>
      <h1 class="text-[32px] font-black leading-none text-white">PROGRESS</h1>
    </div>

    <!-- stats row — 4 figma cards (bg-card border white/10 rounded-2xl) -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div v-for="i in 4" :key="i" class="bg-card border border-white/10 rounded-2xl p-4 h-[92px] animate-pulse" />
    </div>
    <ProgressStatsGrid v-else-if="data" :data="data" />

    <!-- new: 28-day consistency — Figma-style bar card -->
    <div v-if="!loading && data?.goalProgress" class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-5">
      <div class="flex items-center justify-between">
        <p class="text-[11px] font-bold uppercase tracking-widest text-muted">Consistency — Last 28 Days</p>
        <span class="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{{ data.goalProgress.pct }}%</span>
      </div>
      <div class="flex items-baseline gap-2">
        <p class="text-[22px] font-black leading-none text-white">{{ data.goalProgress.completed }}<span class="text-sm font-bold text-muted">/{{ data.goalProgress.planned }}</span></p>
        <p class="text-[11px] font-normal text-muted">runs completed</p>
      </div>
      <div class="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div class="h-full rounded-full bg-primary transition-all" :style="{ width: data.goalProgress.pct + '%' }"></div>
      </div>
    </div>

    <!-- weekly volume — keep chart component but wrap with figma header gap -->
    <WeeklyVolumeChart :data="data?.volumeSeries || []" :loading="loading" />

    <!-- pace + HR — two figma cards -->
    <div class="grid md:grid-cols-2 gap-4">
      <PaceChart title="Pace Trend (sec/km)" :points="pacePoints" labelKey="label" valueKey="pace" color="#F97316" :loading="loading" />
      <PaceChart title="Heart Rate Trend" :points="pacePoints" labelKey="label" valueKey="hr" color="#EF4444" :loading="loading" />
    </div>

    <template v-if="data">
      <!-- fatigue signals — warning tint but card shape matches Figma rounded-2xl -->
      <div v-if="data.trainingState.fatigueSignals.length" class="flex flex-col gap-3 rounded-2xl border border-warning/20 bg-card p-5">
        <div class="flex items-center gap-2">
          <span class="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-warning">Fatigue Signals</span>
          <span class="text-[11px] font-normal text-muted">{{ data.trainingState.fatigueSignals.length }} active</span>
        </div>
        <ul class="flex flex-col gap-2">
          <li v-for="(s,i) in data.trainingState.fatigueSignals" :key="i" class="flex gap-2 items-start text-sm leading-snug">
            <ChevronRightIcon cls="w-4 h-4 shrink-0 mt-0.5 text-warning" />
            <span class="text-white">{{ s }}</span>
          </li>
        </ul>
      </div>

      <!-- best efforts — figma list card -->
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold uppercase tracking-widest text-muted">Best Efforts</p>
          <p class="text-[11px] font-normal text-muted">Top 3 by pace</p>
        </div>
        <div v-if="!data.records.length" class="text-sm text-muted">No records yet — keep running.</div>
        <div v-else class="flex flex-col">
          <div v-for="r in data.records" :key="r.id" class="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-semibold text-white">{{ r.distance_km }} km</span>
              <span class="text-[11px] font-normal text-muted">{{ new Date(r.date).toLocaleDateString() }}</span>
            </div>
            <span class="text-lg font-black leading-none text-white">{{ Math.floor(r.pace/60) }}:{{ String(r.pace%60).padStart(2,'0') }} <span class="text-[11px] font-normal text-muted">/km</span></span>
          </div>
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
import ProgressStatsGrid from '@/components/progress/ProgressStatsGrid.vue'
const data = ref(null); const loading = ref(true)
const pacePoints = computed(() => (data.value?.paceSeries || []).map((p, i) => ({ label: `Run ${i+1}`, pace: p.pace, hr: p.hr })))
onMounted(async () => { try { const { data: d } = await api.get('/progress'); data.value = d } catch {} finally { loading.value = false } })
</script>
