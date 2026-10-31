<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <div class="font-bold text-label text-muted uppercase leading-none tracking-wide">
          {{ headerDate }}
        </div>
        <div class="font-black text-h2 text-white leading-none tracking-tight">
          {{ $t('ui.today_s_workout') }}
        </div>
      </div>
      <div
        v-if="weekMeta"
        class="bg-success/10 px-3 py-1.5 border border-success rounded-full font-bold text-success text-xs whitespace-nowrap shrink-0"
      >
        {{ $t('common.week') }} {{ weekMeta.currentWeek }} {{ $t('common.of') }}
        {{ weekMeta.totalWeeks }}
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
          <div class="flex lg:flex-row flex-col items-start gap-6">
            <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
              <ActivityCard
                v-if="todayActivity"
                :activity="todayActivity"
              />
              <div
                v-else
                class="bg-card p-5 border border-white/10 rounded-2xl text-muted text-sm"
              >
                {{ $t('ui.no_strava_activity_found_yet') }}
                <RouterLink
                  to="/activities"
                  class="text-primaryBright hover:underline"
                  >{{ $t('ui.activities') }}</RouterLink
                >.
              </div>
              <div class="flex flex-col gap-3">
                <p class="font-bold text-label text-muted uppercase leading-none tracking-widest">
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
                class="flex flex-col gap-1.5 bg-card p-4 border border-white/10 rounded-2xl"
              >
                <p class="font-bold text-body text-white uppercase tracking-wide">
                  {{ $t('ui.cross_training_day_title') }}
                </p>
                <p class="font-normal text-muted text-sm">
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
              class="flex flex-col w-full lg:w-[340px] shrink-0"
            >
              <GoalCard
                :goal="goal"
                :week-meta="weekMeta"
              />
              <WeeklyProgression
                class="mt-5"
                :series="volumeSeries"
                :active-index="volumeActiveIndex"
              />
              <WeekSchedule
                class="mt-5"
                :week="week ?? []"
                :today-completed="todayCompleted"
              />
            </div>
          </div>
        </template>

        <template v-else-if="data?.recommendation || data?.workout">
          <div class="flex lg:flex-row flex-col items-start gap-6">
            <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
              <div class="flex flex-col gap-5 bg-card p-5 border border-white/10 rounded-2xl">
                <div class="flex justify-between items-center gap-3">
                  <span
                    class="bg-primary/[0.13] px-2.5 py-1 rounded-md font-bold text-label text-primaryBright uppercase tracking-wide"
                    >{{ workoutTypeLabel }}</span
                  >
                  <span class="flex items-center gap-1.5 shrink-0">
                    <span
                      class="rounded-full w-2 h-2 shrink-0"
                      :class="intensityDotClass"
                    ></span>
                    <span class="font-semibold text-body text-muted">{{ intensityLabel }}</span>
                  </span>
                </div>

                <div
                  v-if="!isRest"
                  class="flex flex-col gap-1"
                >
                  <p class="leading-none">
                    <span class="font-black text-[48px] text-white leading-none">{{
                      displayDistance
                    }}</span>
                    <span class="font-bold text-white text-2xl leading-none">
                      {{ $t('ui.km_unit') }}</span
                    >
                  </p>
                  <p class="text-muted text-sm">
                    ~{{ displayDuration }} min · {{ $t('ui.target_pace') }}
                    <span class="font-bold text-white">{{ displayPace }}</span>
                  </p>
                </div>
                <div
                  v-else
                  class="flex flex-col gap-1"
                >
                  <p class="font-black text-[42px] text-white leading-none">{{ $t('ui.rest') }}</p>
                  <p class="text-muted text-sm">
                    {{ $t('ui.recovery_is_training_no_run_scheduled_today') }}
                  </p>
                </div>

                <div
                  v-if="!isRest"
                  class="flex gap-3"
                >
                  <div
                    class="flex flex-col flex-1 gap-1 bg-background p-3 border border-white/10 rounded-card min-w-0"
                  >
                    <p class="font-semibold text-caption text-muted uppercase tracking-wide">
                      {{ $t('ui.ui_warmup_label') }}
                    </p>
                    <p class="font-bold text-lead text-white leading-none">
                      {{ warmupDist }}
                    </p>
                    <p
                      class="font-normal text-label text-muted truncate leading-tight"
                      :title="warmupText"
                    >
                      {{ warmupSub }}
                    </p>
                  </div>
                  <div
                    class="flex flex-col flex-1 gap-1 bg-primary/[0.13] p-3 border border-primary rounded-card min-w-0"
                  >
                    <p
                      class="font-semibold text-caption text-primaryBright uppercase tracking-wide"
                    >
                      {{ mainLabel }}
                    </p>
                    <p class="font-bold text-lead text-white leading-none">
                      {{ mainDist }}
                    </p>
                    <p
                      class="font-normal text-label text-primaryBright truncate leading-tight"
                      :title="mainSub"
                    >
                      {{ mainSub }}
                    </p>
                  </div>
                  <div
                    class="flex flex-col flex-1 gap-1 bg-background p-3 border border-white/10 rounded-card min-w-0"
                  >
                    <p class="font-semibold text-caption text-muted uppercase tracking-wide">
                      {{ $t('ui.ui_cooldown_label') }}
                    </p>
                    <p class="font-bold text-lead text-white leading-none">
                      {{ cooldownDist }}
                    </p>
                    <p
                      class="font-normal text-label text-muted truncate leading-tight"
                      :title="cooldownText"
                    >
                      {{ cooldownSub }}
                    </p>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5 pt-3 border-white/10 border-t">
                  <p class="font-bold text-label text-muted uppercase tracking-widest">
                    {{ $t('landing.sections.today.why.label') }}
                  </p>
                  <p class="font-normal text-body text-muted leading-[1.4]">
                    {{ coachingText }}
                  </p>
                </div>

                <div
                  v-if="adaptedReason"
                  class="bg-primary/10 p-4 border border-primary/20 rounded-xl"
                >
                  <p class="font-semibold text-caption text-primaryBright">
                    {{ $t('ui.adapted_by_coach') }}
                  </p>
                  <p class="mt-1 text-white text-sm">{{ adaptedReason }}</p>
                </div>
                <div
                  v-else-if="!isRest && data?.recommendation?.alternative"
                  class="bg-primary/10 p-4 border border-primary/20 rounded-xl"
                >
                  <p class="font-semibold text-caption text-primaryBright">
                    {{ $t('ui.if_legs_feel_unusually') }}
                  </p>
                  <p class="mt-1 text-white text-sm">
                    {{ data.recommendation.alternative }}
                  </p>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <p class="font-bold text-label text-muted uppercase leading-none tracking-widest">
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

            <div class="flex flex-col gap-5 w-full lg:w-[340px] shrink-0">
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
          class="mt-4 text-muted text-sm"
        >
          {{ $t('ui.no_workout_available') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
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
  cooldownSub,
  cooldownText,
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
  warmupSub,
  warmupText,
  week,
  weekMeta,
  workoutTypeLabel,
} = useTodayWorkout()

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
