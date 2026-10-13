<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-white text-2xl font-bold">Good morning, {{ displayName }}</h1>
      <p class="text-muted text-sm mt-1">Here's your training overview</p>
    </div>

    <WorkoutCard :workout="today" :loading="planLoading" />

    <AppStats
      :items="[
        { label: 'This Week', value: (state?.weekly?.distance7 ?? 0) + ' km', sub: (state?.weekly?.runs7 ?? 0) + ' runs' },
        { label: 'Avg Pace', value: paceLabel, sub: 'last 7 days' },
        { label: 'Avg HR', value: hrLabel, sub: 'last 7 days' },
        { label: 'Long Run', value: (state?.weekly?.longRun7 ?? 0) + ' km', sub: 'this week' },
      ]"
      :cols="4"
      :loading="!state" />

    <div class="grid md:grid-cols-2 gap-4">
      <WeeklyVolumeChart :data="volumeSeries" :loading="!progress" />
      <GoalProgress :goal="goal" :pct="goalPct" :label="goalLabel" :loading="!progress" />
    </div>

    <CoachInsight :reasons="today?.reasons || []" :loading="planLoading" />

    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-white font-semibold">Recent Activities</h2>
        <RouterLink to="/activities" class="text-primary text-sm hover:underline">View all</RouterLink>
      </div>
      <div v-if="!activities.length" class="grid md:grid-cols-3 gap-4">
        <ActivityCard v-for="n in 3" :key="n" loading />
      </div>
      <div v-else class="grid md:grid-cols-3 gap-4">
        <ActivityCard v-for="a in recent" :key="a.id" :activity="a" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api.js'
import { useCurrentUser } from '@/composables/useCurrentUser.js'
import WeeklyVolumeChart from '@/components/charts/WeeklyVolumeChart.vue'
import GoalProgress from '@/components/coach/GoalProgress.vue'
import CoachInsight from '@/components/coach/CoachInsight.vue'
import ActivityCard from '@/components/ui/ActivityCard.vue'
import AppStats from '@/components/ui/AppStats.vue'
import WorkoutCard from '@/components/ui/WorkoutCard.vue'

const { user: currentUser, fetchUser } = useCurrentUser()
const displayName = computed(() => currentUser.value?.firstname || 'there')

const today = ref(null); const planLoading = ref(true)
const progress = ref(null); const activities = ref([]); const goal = ref(null)

const state = computed(() => progress.value?.trainingState)
const volumeSeries = computed(() => progress.value?.volumeSeries || [])
const recent = computed(() => activities.value.slice(0, 3))
const paceLabel = computed(() => {
  const s = state.value?.weekly?.avgPace7
  return s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} /km` : '—'
})
const hrLabel = computed(() => state.value?.weekly?.avgHr7 ? state.value.weekly.avgHr7 + ' bpm' : '—')
const goalPct = computed(() => progress.value?.goalProgress?.pct ?? null)
const goalLabel = computed(() => {
  const pct = progress.value?.goalProgress?.pct
  if (pct != null && pct >= 80) return 'Crushing it — keep the consistency'
  if (pct != null && pct < 40) return 'Light week — easy to catch up'
  return state.value?.trend === 'building' ? 'Building nicely — stay consistent' : state.value?.trend === 'reducing' ? 'Easing — ready to build again' : 'On track — keep the rhythm'
})

onMounted(async () => {
  fetchUser()
  try { const { data } = await api.get('/plan/today'); today.value = data } catch {} finally { planLoading.value = false }
  try { const { data } = await api.get('/progress'); progress.value = data } catch {}
  try { const { data } = await api.get('/activities', { params: { perPage: 6 } }); activities.value = data.items } catch {}
  try { const { data } = await api.get('/goals'); goal.value = data } catch {}
})
</script>
