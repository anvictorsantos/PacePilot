<template>
  <div class="flex flex-col gap-5">
    <div class="flex justify-between items-start gap-6">
      <div class="flex flex-col items-start gap-1">
        <p class="mb-1.5 font-mono text-label text-faint">
          {{ $t('goals.form.kicker') }}
        </p>
        <h1 class="font-medium text-page text-primary leading-none tracking-tight">
          {{ $t('goals.form.title') }}
        </h1>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div
          v-if="!loading && badgeText"
          class="hidden sm:flex items-center px-3 py-1.5 border-border rounded-full font-medium text-xs leading-none whitespace-nowrap"
          :class="
            badgeOk
              ? 'bg-transparent border-success/40 text-success'
              : 'bg-transparent border-warning/40 text-warning'
          "
        >
          {{ badgeText }}
        </div>
        <button
          class="cursor-pointer border border-white/20 text-muted hover:text-primary px-4 py-2 rounded-lg text-body transition"
          @click="editing = !editing"
        >
          {{ editing ? $t('goals.form.doneButton') : $t('goals.form.editButton') }}
        </button>
      </div>
    </div>

    <!-- reuses the existing form, no new route -->
    <Transition name="fade">
      <div
        v-if="editing"
        class="bg-card border border-white/10 rounded-xl p-6 space-y-4"
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
          <legend class="text-label text-muted">
            {{ $t('goals.form.daysLabel') }}
          </legend>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="day in allDays"
              :key="day"
              :aria-pressed="form.preferred_days?.includes(day)"
              class="cursor-pointer px-3 min-h-touch rounded-full text-sm border-border transition"
              :class="
                form.preferred_days?.includes(day)
                  ? 'bg-primary border-primary text-background'
                  : 'bg-cardSecondary border-white/20 text-muted hover:text-primary'
              "
              @click="toggleDay(day)"
            >
              {{ $t('ui.weekday.' + day.toLowerCase()) }}
            </button>
          </div>
        </fieldset>
        <button
          :disabled="saving"
          class="cursor-pointer w-full bg-primary hover:bg-primaryBright disabled:opacity-50 text-background font-medium py-3 rounded-lg transition disabled:cursor-not-allowed"
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
          <div class="bg-card border border-white/10 rounded-xl p-5 h-[172px] animate-pulse">
            <div class="h-5 bg-white/10 rounded w-1/4 mb-4"></div>
            <div class="h-10 bg-white/5 rounded w-2/3"></div>
          </div>
          <div class="bg-card border border-white/10 rounded-xl p-5 h-[161px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-xl p-5 h-[232px] animate-pulse"></div>
        </div>
        <div class="w-full lg:w-[320px] flex flex-col gap-5 shrink-0">
          <div class="bg-card border border-white/10 rounded-xl p-4 h-[223px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-xl p-4 h-[241px] animate-pulse"></div>
        </div>
      </div>
      <div
        v-else
        key="content"
        class="flex lg:flex-row flex-col items-start gap-6"
      >
        <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
          <div class="flex flex-col gap-5 bg-card p-6 border border-white/10 rounded-xl">
            <div class="flex justify-between items-center gap-3">
              <span
                class="font-mono text-label text-muted"
                >{{ primaryTag }}</span
              >
              <span class="flex items-center gap-1.5 shrink-0">
                <span
                  class="w-2 h-2 rounded-full bg-accent shrink-0"
                  :class="countdownPast ? 'bg-muted' : 'bg-accent'"
                ></span>
                <span
                  class="font-medium text-body"
                  :class="countdownPast ? 'text-muted' : 'text-muted'"
                  >{{ countdownText }}</span
                >
              </span>
            </div>
            <div class="flex flex-col gap-1">
              <p class="font-mono font-medium text-figure leading-none tracking-tight text-primary">
                {{ primaryTitle }}
              </p>
              <p class="font-normal text-body text-muted">{{ primarySubtitle }}</p>
            </div>
            <div class="flex flex-col gap-2">
              <ProgressBar
                :pct="primaryPct"
                :label="$t('goals.display.primaryProgress')"
                size="lg"
              />
              <div class="flex justify-between items-center">
                <span class="font-mono text-caption text-faint"
                  >{{ primaryPct }}{{ $t('goals.display.toGoalWindow') }}</span
                >
                <span class="font-mono text-caption text-faint">{{
                  weekMeta
                    ? `${weekMeta.currentWeek} / ${weekMeta.totalWeeks} ${$t('goals.display.weeks')}`
                    : goalProgress
                      ? `${goalProgress.completed}/${goalProgress.planned} ${$t('goals.display.runs28d')}`
                      : ''
                }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <p class="font-mono text-caption text-faint uppercase tracking-widest">
              {{ $t('goals.display.secondary') }}
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="row in secondaryRows"
                :key="row.label"
                class="flex justify-between items-center gap-3 bg-card px-3.5 py-3 border border-white/10 rounded-lg"
              >
                <p class="font-medium text-body text-primary truncate min-w-0 flex-1">
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
                  <span class="font-mono text-label text-primary w-[36px] text-right leading-none">{{
                    row.value
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4 bg-card p-6 border border-white/10 rounded-xl">
            <p class="font-medium text-sm text-primary">
              {{ $t('goals.display.milestones') }}
            </p>
            <div class="flex flex-col gap-3">
              <div
                v-for="m in milestones"
                :key="m.title"
                class="flex items-center gap-3"
              >
                <div
                  class="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border border-solid"
                  :class="
                    m.done ? 'bg-accent/10 border-accent' : 'bg-transparent border-white/10'
                  "
                >
                  <CheckIcon
                    v-if="m.done"
                    cls="w-3 h-3 text-accent"
                  />
                </div>
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <p
                    class="font-medium text-body leading-none truncate"
                    :class="m.done ? 'text-primary' : 'text-muted'"
                  >
                    {{ m.title }}
                  </p>
                  <p class="font-normal text-label leading-none text-muted">{{ m.dateLabel }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-5 w-full lg:w-[320px] shrink-0">
          <div class="flex flex-col gap-4 bg-card p-4.5 border border-white/10 rounded-xl">
            <p class="font-mono text-caption text-faint uppercase tracking-widest">
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
                  class="font-mono text-caption text-faint uppercase tracking-wide leading-none"
                >
                  {{ m.label }}
                </p>
                <p class="font-mono text-lead leading-none text-primary">{{ m.value }}</p>
                <p
                  v-if="m.sub"
                  class="font-normal text-label leading-none text-muted"
                >
                  {{ m.sub }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3 bg-card p-4.5 border border-white/10 rounded-xl">
            <p class="font-mono text-caption text-faint uppercase tracking-widest">
              {{ $t('goals.display.best') }}
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="pr in prRows"
                :key="String(pr.id)"
                class="flex justify-between items-center bg-cardSecondary px-3 py-3 border border-white/10 rounded-lg"
              >
                <div class="flex flex-col gap-0.5 min-w-0">
                  <p class="font-medium text-body leading-none text-primary">{{ pr.distLabel }}</p>
                  <p class="font-normal text-label leading-none text-muted">{{ pr.dateLabel }}</p>
                </div>
                <p class="font-medium text-lead leading-none text-accent shrink-0 ml-3">
                  {{ pr.timeLabel }}
                </p>
              </div>
              <p
                v-if="!prRows.length"
                class="text-muted text-label py-2"
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

import CheckIcon from '@/components/icons/CheckIcon.vue'
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

// The shared form's fields are nullable while the UI controls declare non-null
// models; these adapters bridge the two without narrowing the form itself.
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
