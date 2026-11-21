<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-start gap-6">
      <div>
        <div class="mb-1.5 font-mono text-label text-faint">{{ headerDate }}</div>
        <h2 class="font-medium text-page text-primary tracking-tight leading-none">
          {{ $t('ui.today_s_workout') }}
        </h2>
      </div>
      <div
        v-if="weekMeta"
        class="font-mono text-label text-muted text-right leading-relaxed whitespace-nowrap"
      >
        {{ $t('common.week') }} {{ weekMeta.currentWeek }} {{ $t('common.of') }}
        {{ weekMeta.totalWeeks }}
        <template v-if="plannedKm"> <br />{{ plannedKm }} {{ $t('ui.km_unit') }} </template>
      </div>
    </div>

    <Transition
      name="fade"
      mode="out-in"
    >
      <Skeleton
        v-if="loading"
        key="skeleton"
      />
      <div
        v-else
        key="content"
      >
        <!-- completed state (keeps adaptive loop) -->
        <template v-if="todayCompleted">
          <div class="flex lg:flex-row flex-col items-start gap-5">
            <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
              <ActivityCard
                v-if="todayActivity"
                :activity="todayActivity"
              />
              <div
                v-else
                class="bg-card p-6 border border-white/10 rounded-xl text-muted text-body"
              >
                {{ $t('ui.no_strava_activity_found_yet') }}
                <RouterLink
                  to="/activities"
                  class="text-primary hover:underline"
                  >{{ $t('ui.activities') }}</RouterLink
                >.
              </div>
              <div class="flex flex-col gap-3">
                <p class="font-mono text-caption text-faint uppercase tracking-widest">
                  {{ $t('ui.performance_insights') }}
                </p>
                <div class="flex gap-3 max-lg:grid max-lg:grid-cols-2">
                  <InsightCard
                    v-for="m in insightCards"
                    :key="m.label"
                    :label="m.label"
                    :value="m.value"
                    :sub="m.sub"
                    :tone="m.tone"
                    class="flex-1 min-w-0"
                  />
                </div>
              </div>

              <!-- cross-training has no run feedback to ask for (issue #8) -->
              <div
                v-if="crossTraining && !feedbackSaved"
                class="flex flex-col gap-1.5 bg-card p-6 border border-white/10 rounded-xl"
              >
                <p class="font-medium text-sm text-primary">
                  {{ $t('ui.cross_training_day_title') }}
                </p>
                <p class="font-normal text-muted text-body">
                  {{ $t('ui.cross_training_day_body') }}
                </p>
              </div>
              <WorkoutFeedbackForm
                v-else
                v-model:rpe="rpe"
                v-model:status="status"
                v-model:note="note"
                :feedback-saved="feedbackSaved"
                :submitting="submitting"
                :header-date-short="headerDateShort"
                :saved-message="$t('ui.saved_session_logged')"
                @submit="submitFeedback"
              />
            </div>
            <div
              v-if="hasGoalPanel"
              class="flex flex-col w-full lg:w-[300px] shrink-0"
            >
              <GoalCard
                :goal="goal"
                :week-meta="weekMeta"
              />
              <WeeklyProgression
                class="mt-4"
                :series="volumeSeries"
                :active-index="volumeActiveIndex"
              />
              <WeekSchedule
                class="mt-4"
                :week="week ?? []"
                :today-completed="todayCompleted"
              />
            </div>
          </div>
        </template>

        <template v-else-if="data?.recommendation || data?.workout">
          <div class="flex lg:flex-row flex-col items-start gap-5">
            <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
              <div class="flex flex-col gap-5 bg-card p-6 border border-white/10 rounded-xl">
                <div class="flex justify-between items-center gap-3">
                  <span class="text-body text-muted">{{ workoutTypeLabel }}</span>
                  <span class="flex items-center gap-1.5 shrink-0">
                    <span
                      class="rounded-full w-1.5 h-1.5 shrink-0"
                      :class="intensityDotClass"
                    ></span>
                    <span class="text-body text-muted">{{ intensityLabel }}</span>
                  </span>
                </div>

                <div
                  v-if="!isRest"
                  class="flex flex-col gap-1.5"
                >
                  <div class="flex items-baseline gap-4.5 flex-wrap">
                    <p class="leading-none">
                      <span class="font-mono font-medium text-figure text-primary tracking-tight">{{
                        displayDistance
                      }}</span>
                      <small class="ml-1 font-normal text-lead text-muted">{{
                        $t('ui.km_unit')
                      }}</small>
                    </p>
                    <p class="font-mono text-lead text-primary">
                      {{ displayPace
                      }}<em class="not-italic text-muted"> {{ $t('ui.pace_unit') }}</em>
                    </p>
                  </div>
                  <p class="text-body text-faint">
                    ~{{ displayDuration }} {{ $t('ui.min') }} ·
                    {{ $t('ui.target_pace') }}
                    <span class="font-mono text-primary">{{ displayPace }}</span>
                  </p>
                </div>
                <div
                  v-else
                  class="flex flex-col gap-1"
                >
                  <p class="font-mono font-medium text-figure text-primary leading-none">
                    {{ $t('ui.rest') }}
                  </p>
                  <p class="text-body text-muted">
                    {{ $t('ui.recovery_is_training_no_run_scheduled_today') }}
                  </p>
                </div>

                <template v-if="!isRest">
                  <div
                    class="flex gap-[3px] h-3"
                    aria-hidden="true"
                  >
                    <i
                      class="rounded-sm bg-[#2c2c34]"
                      :style="{ width: `${segmentWidths[0]}%` }"
                    ></i>
                    <i
                      class="rounded-sm bg-accent"
                      :style="{ width: `${segmentWidths[1]}%` }"
                    ></i>
                    <i
                      class="rounded-sm bg-[#2c2c34]"
                      :style="{ width: `${segmentWidths[2]}%` }"
                    ></i>
                  </div>
                  <div class="flex gap-[3px]">
                    <div
                      class="font-mono text-label text-muted overflow-hidden"
                      :style="{ width: `${segmentWidths[0]}%` }"
                    >
                      {{ warmupDist
                      }}<b class="block font-normal text-caption text-faint">{{
                        $t('ui.ui_warmup_label')
                      }}</b>
                    </div>
                    <div
                      class="font-mono text-label text-muted overflow-hidden"
                      :style="{ width: `${segmentWidths[1]}%` }"
                    >
                      {{ mainDist }} · {{ mainSub
                      }}<b class="block font-normal text-caption text-faint">{{ mainLabel }}</b>
                    </div>
                    <div
                      class="font-mono text-label text-muted overflow-hidden"
                      :style="{ width: `${segmentWidths[2]}%` }"
                    >
                      {{ cooldownDist
                      }}<b class="block font-normal text-caption text-faint">{{
                        $t('ui.ui_cooldown_label')
                      }}</b>
                    </div>
                  </div>
                </template>

                <div
                  v-if="!isRest"
                  class="mt-1 pt-4 border-t border-white/10 max-w-[56ch] text-body text-muted leading-relaxed"
                >
                  <b class="font-medium text-primary">{{
                    $t('landing.sections.today.why.label')
                  }}</b>
                  {{ coachingText }}
                </div>

                <div
                  v-if="adaptedReason"
                  class="bg-cardSecondary p-4 border border-white/10 rounded-lg"
                >
                  <p class="font-mono text-caption text-accent">
                    {{ $t('ui.adapted_by_coach') }}
                  </p>
                  <p class="mt-1 text-primary text-body">{{ adaptedReason }}</p>
                </div>
                <div
                  v-else-if="!isRest && data?.recommendation?.alternative"
                  class="bg-cardSecondary p-4 border border-white/10 rounded-lg"
                >
                  <p class="font-mono text-caption text-accent">
                    {{ $t('ui.if_legs_feel_unusually') }}
                  </p>
                  <p class="mt-1 text-primary text-body">
                    {{ data.recommendation.alternative }}
                  </p>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <p class="font-mono text-caption text-faint uppercase tracking-widest">
                  {{ $t('ui.performance_insights') }}
                </p>
                <div class="flex gap-3 max-lg:grid max-lg:grid-cols-2">
                  <InsightCard
                    v-for="m in insightCards"
                    :key="m.label"
                    :label="m.label"
                    :value="m.value"
                    :sub="m.sub"
                    :tone="m.tone"
                    class="flex-1 min-w-0"
                  />
                </div>
              </div>

              <!-- locked: saved values are view-only -->
              <WorkoutFeedbackForm
                v-model:rpe="rpe"
                v-model:status="status"
                v-model:note="note"
                :feedback-saved="feedbackSaved"
                :submitting="submitting"
                :header-date-short="headerDateShort"
                :saved-message="$t('ui.saved_session_logged')"
                :rest-day="isRest"
                @submit="submitFeedback"
              />
            </div>

            <div class="flex flex-col gap-4 w-full lg:w-[300px] shrink-0">
              <GoalCard
                :goal="goal"
                :week-meta="weekMeta"
              />
              <WeeklyProgression
                :series="volumeSeries"
                :active-index="volumeActiveIndex"
              />
              <WeekSchedule
                :week="week ?? []"
                :today-completed="todayCompleted"
              />
            </div>
          </div>
        </template>
        <div
          v-else
          class="mt-4 text-muted text-body"
        >
          {{ $t('ui.no_workout_available') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import GoalCard from '@/components/shared/GoalCard.vue'
import ActivityCard from '@/components/ui/ActivityCard.vue'
import InsightCard from '@/components/ui/InsightCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import WeeklyProgression from '@/features/today/components/WeeklyProgression.vue'
import WeekSchedule from '@/features/today/components/WeekSchedule.vue'
import WorkoutFeedbackForm from '@/features/today/components/WorkoutFeedbackForm.vue'
import { useTodayWorkout } from '@/features/today/composables/useTodayWorkout.ts'
import { useRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'

const {
  adaptedReason,
  coachingText,
  cooldownDist,
  data,
  displayDistance,
  displayDuration,
  displayPace,
  goal,
  hasGoalPanel,
  headerDate,
  headerDateShort,
  insightCards,
  intensityDotClass,
  intensityLabel,
  isRest,
  loading,
  mainDist,
  mainLabel,
  mainSub,
  volumeActiveIndex,
  volumeSeries,
  warmupDist,
  week,
  weekMeta,
  workoutTypeLabel,
} = useTodayWorkout()

const segmentWidths = computed(() => {
  const rec = data.value?.recommendation
  const parts = [rec?.warmup_km, rec?.main_km, rec?.cooldown_km].map((km) => Number(km) || 0)
  const total = parts.reduce((sum, km) => sum + km, 0)
  if (!total) return [0, 100, 0]
  return parts.map((km) => Math.round((km / total) * 100))
})

const plannedKm = computed(() => {
  const total = (week.value ?? []).reduce(
    (sum, day) => sum + (Number(day.workout?.distance_km) || 0),
    0,
  )
  return total ? total.toFixed(0) : ''
})

const {
  activity: todayActivity,
  completed: todayCompleted,
  crossTraining,
  feedbackSaved,
  note,
  rpe,
  status,
  submitting,
  submitFeedback,
} = useRunDay()
</script>
