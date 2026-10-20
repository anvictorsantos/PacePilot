<template>
  <div class="flex flex-col gap-6">
    <!-- header-block -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <p class="font-bold text-label text-muted uppercase leading-none tracking-wide">
          {{ $t('goals.form.kicker') }}
        </p>
        <h1 class="font-black text-h2 text-white leading-none tracking-tight">
          {{ $t('goals.form.title') }}
        </h1>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div
          v-if="!loading && badgeText"
          class="hidden sm:flex items-center px-3 py-1.5 border-border rounded-full font-bold text-xs leading-none whitespace-nowrap"
          :class="
            badgeOk
              ? 'bg-success/10 border-success text-success'
              : 'bg-warning/10 border-warning text-warning'
          "
        >
          {{ badgeText }}
        </div>
        <button
          class="bg-white text-background hover:bg-white/90 px-4 py-2 rounded-full font-bold text-xs leading-none transition"
          @click="editing = !editing"
        >
          {{ editing ? $t('goals.form.doneButton') : $t('goals.form.editButton') }}
        </button>
      </div>
    </div>

    <!-- edit sheet (ponytail: reuses existing form, no new route) -->
    <Transition name="fade">
      <div
        v-if="editing"
        class="bg-card border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div>
          <AppSelect
            id="goal-type"
            v-model="goalTypeModel"
            :options="goalTypeOptions"
            class="mt-1"
            :label="$t('goals.form.goalTypeLabel')"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <AppInputGroup
              v-model="targetTimeModel"
              type="number"
              :placeholder="$t('goals.form.targetTimePlaceholder')"
              :trailing-addon="$t('ui.min')"
              number
              class="mt-1"
              :label="$t('goals.form.targetTimeLabel')"
            />
          </div>
          <div>
            <AppCalendar
              id="goal-date"
              v-model="goalDateModel"
              class="mt-1"
              :label="$t('goals.form.goalDateLabel')"
            />
          </div>
        </div>
        <fieldset>
          <legend class="text-muted text-xs uppercase tracking-widest">
            {{ $t('goals.form.daysLabel') }}
          </legend>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="day in allDays"
              :key="day"
              :aria-pressed="form.preferred_days?.includes(day)"
              class="px-3 min-h-touch rounded-full text-sm border-border transition"
              :class="
                form.preferred_days?.includes(day)
                  ? 'bg-primary border-primary text-white'
                  : 'bg-white/5 border-white/10 text-muted hover:text-white'
              "
              @click="toggleDay(day)"
            >
              {{ $t('ui.weekday.' + day.toLowerCase()) }}
            </button>
          </div>
        </fieldset>
        <button
          :disabled="saving"
          class="w-full bg-primary hover:bg-primaryBright disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
          @click="save"
        >
          {{ saving ? $t('goals.form.saving') : $t('goals.form.saveButton') }}
        </button>
        <div
          v-if="saved"
          class="text-success text-sm text-center"
        >
          {{ $t('goals.form.saved') }}
        </div>
      </div>
    </Transition>

    <Transition
      name="fade"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="sk"
        class="flex lg:flex-row flex-col gap-6"
      >
        <div class="flex-1 flex flex-col gap-5">
          <div class="bg-card border border-white/10 rounded-2xl p-5 h-[172px] animate-pulse">
            <div class="h-5 bg-white/10 rounded w-1/4 mb-4"></div>
            <div class="h-10 bg-white/5 rounded w-2/3"></div>
          </div>
          <div class="bg-card border border-white/10 rounded-2xl p-5 h-[161px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-2xl p-5 h-[232px] animate-pulse"></div>
        </div>
        <div class="w-full lg:w-[340px] flex flex-col gap-5 shrink-0">
          <div class="bg-card border border-white/10 rounded-2xl p-4 h-[223px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-2xl p-4 h-[241px] animate-pulse"></div>
        </div>
      </div>
      <div
        v-else
        key="content"
        class="flex lg:flex-row flex-col items-start gap-6"
      >
        <!-- left-col -->
        <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
          <!-- primary-goal-card -->
          <div class="flex flex-col gap-5 bg-card p-5 border border-white/10 rounded-2xl">
            <!-- type-row -->
            <div class="flex justify-between items-center gap-3">
              <span
                class="bg-primary/10 px-2.5 py-1 rounded-md font-bold text-label text-primary uppercase tracking-wide"
                >{{ primaryTag }}</span
              >
              <span class="flex items-center gap-1.5 shrink-0">
                <span
                  class="w-2 h-2 rounded-full bg-primary shrink-0"
                  :class="countdownPast ? 'bg-muted' : 'bg-primary'"
                ></span>
                <span
                  class="font-semibold text-body"
                  :class="countdownPast ? 'text-muted' : 'text-muted'"
                  >{{ countdownText }}</span
                >
              </span>
            </div>
            <!-- goal-target -->
            <div class="flex flex-col gap-1">
              <p class="font-black text-[40px] leading-none tracking-tight text-white">
                {{ primaryTitle }}
              </p>
              <p class="font-normal text-sm leading-none text-muted">{{ primarySubtitle }}</p>
            </div>
            <!-- progress-bar-track -->
            <div class="flex flex-col gap-2">
              <ProgressBar
                :pct="primaryPct"
                :label="$t('goals.display.primaryProgress')"
                size="lg"
              />
              <div class="flex justify-between items-center">
                <span class="font-semibold text-label text-muted"
                  >{{ primaryPct }}{{ $t('goals.display.toGoalWindow') }}</span
                >
                <span class="font-semibold text-label text-muted">{{
                  goalProgress
                    ? `${goalProgress.completed}/${goalProgress.planned} ${$t('goals.display.runs28d')}`
                    : weekMeta
                      ? `${weekMeta.currentWeek} / ${weekMeta.totalWeeks} ${$t('goals.display.weeks')}`
                      : ''
                }}</span>
              </div>
            </div>
          </div>

          <!-- secondary-goals-container -->
          <div class="flex flex-col gap-3">
            <p class="font-bold text-label text-muted uppercase tracking-widest">
              {{ $t('goals.display.secondary') }}
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="row in secondaryRows"
                :key="row.label"
                class="flex justify-between items-center gap-3 bg-card px-3 py-3 border border-white/10 rounded-xl"
              >
                <p class="font-semibold text-body text-white truncate min-w-0 flex-1">
                  {{ row.label }}
                </p>
                <div class="flex items-center gap-2 shrink-0">
                  <ProgressBar
                    class="w-[60px]"
                    :pct="row.pct"
                    :label="row.label"
                    size="xs"
                    :bar-class="row.barClass"
                  />
                  <span class="font-bold text-xs text-white w-[36px] text-right leading-none">{{
                    row.value
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- milestones-card -->
          <div class="flex flex-col gap-4 bg-card p-5 border border-white/10 rounded-2xl">
            <p class="font-bold text-body text-white uppercase tracking-wide">
              {{ $t('goals.display.milestones') }}
            </p>
            <div class="flex flex-col gap-3">
              <div
                v-for="m in milestones"
                :key="m.title"
                class="flex items-center gap-3"
              >
                <div
                  class="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-border"
                  :class="
                    m.done ? 'bg-primary/10 border-primary' : 'bg-transparent border-white/10'
                  "
                >
                  <svg
                    class="w-3 h-3"
                    :class="m.done ? 'text-primary' : 'text-muted opacity-60'"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2.5 6L5 8.5L9.5 3.5" />
                  </svg>
                </div>
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <p
                    class="font-medium text-body leading-none truncate"
                    :class="m.done ? 'text-white' : 'text-muted'"
                  >
                    {{ m.title }}
                  </p>
                  <p class="font-normal text-label leading-none text-muted">{{ m.dateLabel }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- right-col -->
        <div class="flex flex-col gap-5 w-full lg:w-[340px] shrink-0">
          <!-- metrics-card -->
          <div class="flex flex-col gap-4 bg-card p-4 border border-white/10 rounded-2xl">
            <p class="font-bold text-label text-muted uppercase tracking-widest">
              {{ $t('goals.display.glance') }}
            </p>
            <div class="flex flex-col">
              <div
                v-for="(m, i) in glanceMetrics"
                :key="m.label"
                class="flex flex-col gap-1 py-3"
                :class="i !== 0 ? 'border-t border-white/10' : ''"
              >
                <p
                  class="font-semibold text-caption text-muted uppercase tracking-wide leading-none"
                >
                  {{ m.label }}
                </p>
                <p class="font-extrabold text-lg leading-none text-white">{{ m.value }}</p>
                <p
                  v-if="m.sub"
                  class="font-normal text-label leading-none text-muted"
                >
                  {{ m.sub }}
                </p>
              </div>
            </div>
          </div>

          <!-- prs-card -->
          <div class="flex flex-col gap-3 bg-card p-4 border border-white/10 rounded-2xl">
            <p class="font-bold text-label text-muted uppercase tracking-widest">
              {{ $t('goals.display.best') }}
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="pr in prRows"
                :key="String(pr.id)"
                class="flex justify-between items-center bg-background px-3 py-3 border border-white/10 rounded-xl"
              >
                <div class="flex flex-col gap-0.5 min-w-0">
                  <p class="font-bold text-sm leading-none text-white">{{ pr.distLabel }}</p>
                  <p class="font-normal text-label leading-none text-muted">{{ pr.dateLabel }}</p>
                </div>
                <p class="font-extrabold text-lead leading-none text-primary shrink-0 ml-3">
                  {{ pr.timeLabel }}
                </p>
              </div>
              <p
                v-if="!prRows.length"
                class="text-muted text-xs py-2"
              >
                {{ $t('goals.display.noPrs') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import AppCalendar from '@/components/ui/AppCalendar.vue'
import AppInputGroup from '@/components/ui/AppInputGroup.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import { useGoals } from '@/features/goals/composables/useGoals.ts'

const {
  loading,
  saving,
  saved,
  editing,
  weekMeta,
  goalProgress,
  goalTypeOptions,
  allDays,
  form,
  toggleDay,
  primaryTag,
  primaryTitle,
  primarySubtitle,
  countdownPast,
  countdownText,
  badgeOk,
  badgeText,
  primaryPct,
  secondaryRows,
  milestones,
  glanceMetrics,
  prRows,
  save,
} = useGoals()

// The shared form's fields are nullable (`goal_type`, `target_time_min`,
// `goal_date`), while the UI controls declare non-null models. These adapters
// keep the controls' declared types without narrowing the form itself.
const goalTypeModel = computed<string | number>({
  get: () => form.value.goal_type ?? '',
  set: (v) => {
    form.value.goal_type = v as string | null
  },
})
const targetTimeModel = computed<string | number>({
  get: () => form.value.target_time_min ?? '',
  set: (v) => {
    form.value.target_time_min = v as number | null
  },
})
const goalDateModel = computed<string>({
  get: () => form.value.goal_date ?? '',
  set: (v) => {
    form.value.goal_date = v
  },
})
</script>
