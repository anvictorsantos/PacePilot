<template>
  <div class="flex flex-col gap-6">
    <Skeleton v-if="loading" />

    <template v-else-if="activity">
      <ActivityHeader
        :date="activity.date"
        :title="runTitle"
      />

      <div class="flex lg:flex-row flex-col gap-6">
        <!-- left-col -->
        <div class="flex flex-col gap-6 flex-1 min-w-0">
          <PaceHrChart
            :streams="activity.streams"
            :distance-km="
              activity.distance_km ??
              (activity.distance_m != null ? activity.distance_m / 1000 : null)
            "
          />
          <LapsTable :laps="activity.laps || []" />

          <!-- achievements kept from existing detail, below laps -->
          <div
            v-if="trophies.length"
            class="bg-card border border-white/10 rounded-2xl p-5"
          >
            <div class="flex items-center gap-2 text-white font-semibold text-sm mb-3">
              <TrophyIcon cls="w-4 h-4 text-primary" />
              {{ $t('ui.achievements') }}
              <span class="text-muted font-normal"
                >· {{ activity.achievement_count || trophies.length }} {{ $t('ui.trophies') }}
                {{ prText }}</span
              >
            </div>
            <div class="space-y-2">
              <div
                v-for="(trophy, i) in trophies"
                :key="i"
                class="flex items-center justify-between text-sm border-b border-white/5 py-2 last:border-0"
              >
                <span class="text-white truncate pr-4">{{ t.segment }}</span>
                <span
                  class="inline-flex items-center gap-1.5 shrink-0 text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/80"
                >
                  <TrophyIcon cls="w-3.5 h-3.5 text-primary" /> {{ t.label
                  }}<span
                    v-if="t.time != null"
                    class="text-white"
                  >
                    {{ fmtTime(t.time) }}</span
                  >
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="activity.analysis"
            class="bg-gradient-to-br from-primary/10 to-card border border-primary/20 rounded-2xl p-5"
          >
            <div class="text-primary text-xs tracking-widest font-semibold">
              {{ $t('ui.coach_analysis') }}
            </div>
            <p class="text-white text-sm mt-2">{{ activity.analysis }}</p>
          </div>
        </div>

        <!-- right-col -->
        <div class="flex flex-col gap-5 w-full lg:w-[340px] shrink-0">
          <DistanceLoadCard :activity="activity" />
          <KeyMetricsGrid :activity="activity" />
          <SplitsBarCard
            :laps="activity.laps || []"
            :streams="activity.streams"
            :total-km="
              activity.distance_km ??
              (activity.distance_m != null ? activity.distance_m / 1000 : null)
            "
          />
        </div>
      </div>
    </template>

    <div
      v-else
      class="text-muted text-sm"
    >
      {{ $t('ui.activity_not_found') }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import TrophyIcon from '@/components/icons/TrophyIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ActivityHeader from '@/features/activities/components/ActivityHeader.vue'
import DistanceLoadCard from '@/features/activities/components/DistanceLoadCard.vue'
import KeyMetricsGrid from '@/features/activities/components/KeyMetricsGrid.vue'
import LapsTable from '@/features/activities/components/LapsTable.vue'
import PaceHrChart from '@/features/activities/components/PaceHrChart.vue'
import SplitsBarCard from '@/features/activities/components/SplitsBarCard.vue'
import { getActivity } from '@/services/activities.js'
import { formatShortTime as fmtTime } from '@/utils/format.js'
import { activityTitle } from '@/utils/labels.js'

const route = useRoute()
const { t } = useI18n()
const activity = ref(null)
const loading = ref(true)

const runTitle = computed(() => activityTitle(activity.value))
const trophies = computed(() => activity.value?.trophies || [])
const prCount = computed(
  () => activity.value?.pr_count ?? trophies.value.filter((t) => t.type === 'pr').length,
)
const prText = computed(() => {
  if (!prCount.value) return ''
  return ` · ${prCount.value} ${t(prCount.value > 1 ? 'ui.prs' : 'ui.pr')}`
})

onMounted(async () => {
  try {
    const data = await getActivity(route.params.id)
    activity.value = data
  } catch {
  } finally {
    loading.value = false
  }
})
</script>
