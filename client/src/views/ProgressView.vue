<template>
  <div class="flex flex-col gap-6">
    <!-- header-block — mimics TodayWorkoutView 9:527 -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <p class="font-bold text-muted text-xs uppercase leading-none tracking-widest">Your Journey</p>
        <h1 class="font-black text-white text-3xl leading-none tracking-tight">PROGRESS</h1>
      </div>
    </div>

    <ProgressSkeleton v-if="loading" />

    <!-- analytics-columns — mimics Today columns-layout 9:533 -->
    <div v-else class="flex lg:flex-row flex-col items-start gap-6">
      <!-- left-charts-col — flex-1 like Today left -->
      <div class="flex flex-col flex-1 gap-4 w-full min-w-0">
        <WeeklyVolumeChart :data="data?.volumeSeries || []" :loading="loading" />
        <PaceTrendCard :points="pacePoints" />
      </div>
      <!-- right-stats-col — w-[340px] like Today right -->
      <div class="flex flex-col gap-4 w-full lg:w-[340px] shrink-0">
        <GoalCard v-if="goal && weekMeta" :goal="goal" :week-meta="weekMeta" />
        <ConsistencyCard v-if="data?.goalProgress" :pct="data.goalProgress.pct" />
        <IntensityCard
          v-if="data"
          title="Intensity Distribution"
          :value="data.trainingState.weekly.longRun28"
          unit="km"
          badge="Peak"
          hint="28-day best long run — distribution below is placeholder until zone data lands."
          :zones="[
            { label: 'Aerobic / Easy Run', pct: 70 },
            { label: 'Tempo / Threshold', pct: 20 },
            { label: 'Intervals / Hard', pct: 10 },
          ]"
        />
        <FatigueCard v-if="data" :signals="data.trainingState.fatigueSignals" />
      </div>
    </div>

    <SectionDivider v-if="!loading && data" />

    <!-- key-metrics-summary -->
    <div v-if="!loading && data" class="flex w-full">
      <ProgressStatsGrid :data="data" class="flex-1" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from "vue";
import api from "@/services/api.js";
import WeeklyVolumeChart from "@/components/charts/WeeklyVolumeChart.vue";
import PaceTrendCard from "@/components/progress/PaceTrendCard.vue";
import ProgressStatsGrid from "@/components/progress/ProgressStatsGrid.vue";
import ProgressSkeleton from "@/components/progress/ProgressSkeleton.vue";
import SectionDivider from "@/components/ui/SectionDivider.vue";
import ConsistencyCard from "@/components/progress/ConsistencyCard.vue";
import GoalCard from "@/components/progress/GoalCard.vue";
import FatigueCard from "@/components/progress/FatigueCard.vue";
import IntensityCard from "@/components/progress/IntensityCard.vue";
const data = ref(null);
const loading = ref(true);
const goal = ref(null);
const weekMeta = ref(null);
const pacePoints = computed(() =>
  (data.value?.paceSeries || []).map((p, i) => ({
    label: `Run ${i + 1}`,
    pace: p.pace,
    hr: p.hr,
  })),
);
onMounted(async () => {
  try {
    const { data: d } = await api.get("/progress");
    data.value = d;
  } catch {}
  try {
    const { data: w } = await api.get("/plan/week");
    goal.value = w.goal || null;
    weekMeta.value = w.weekMeta || null;
  } catch {}
  loading.value = false;
});
</script>
