<template>
  <div class="flex flex-col gap-5">
    <div class="flex justify-between items-start gap-6">
      <div>
        <p class="mb-1.5 font-mono text-label text-faint">{{ primaryTag }}</p>
        <h1 class="font-medium text-page text-primary leading-none tracking-tight">
          {{ $t('goals.form.title') }}
        </h1>
      </div>
      <div
        v-if="weekMeta"
        class="font-mono text-label text-muted text-right leading-relaxed whitespace-nowrap"
      >
        {{ $t('common.week') }} {{ weekMeta.currentWeek }} {{ $t('common.of') }}
        {{ weekMeta.totalWeeks }}<br />{{ countdownText }}
      </div>
    </div>

    <Transition
      name="fade"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="sk"
        class="flex lg:flex-row flex-col gap-5"
      >
        <div class="flex-1 flex flex-col gap-5">
          <div class="bg-card border border-white/10 rounded-xl p-6 h-[230px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-xl p-6 h-[340px] animate-pulse"></div>
        </div>
        <div class="w-full lg:w-[320px] flex flex-col gap-4 shrink-0">
          <div class="bg-card border border-white/10 rounded-xl p-5 h-[160px] animate-pulse"></div>
          <div class="bg-card border border-white/10 rounded-xl p-5 h-[280px] animate-pulse"></div>
        </div>
      </div>

      <div
        v-else
        key="content"
        class="grid lg:grid-cols-[1fr_320px] gap-5 items-start"
      >
        <div class="flex flex-col gap-5 min-w-0">
          <div class="bg-card p-6 border border-white/10 rounded-xl">
            <h3 class="font-medium text-sm text-primary">{{ $t('goals.display.currentGoal') }}</h3>
            <p class="mt-1 mb-5 text-body text-faint">{{ $t('goals.display.currentHint') }}</p>
            <div class="flex items-baseline gap-4 flex-wrap">
              <p class="font-mono font-medium text-figure text-primary tracking-tight leading-none">
                {{ primaryTitle }}
              </p>
              <p class="text-body text-muted">{{ primarySubtitle }}</p>
            </div>
            <div class="mt-4 flex flex-col gap-2">
              <ProgressBar
                :pct="primaryPct"
                :label="$t('goals.display.primaryProgress')"
                size="md"
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

          <div class="bg-card p-6 border border-white/10 rounded-xl">
            <h3 class="font-medium text-sm text-primary">{{ $t('goals.display.editGoal') }}</h3>
            <p class="mt-1 mb-5 text-body text-faint">{{ $t('goals.display.editHint') }}</p>

            <div class="grid sm:grid-cols-2 gap-4">
              <AppSelect
                id="goal-type"
                v-model="goalTypeModel"
                :options="goalTypeOptions"
                :label="$t('goals.form.goalTypeLabel')"
              />
              <AppCalendar
                id="goal-date"
                v-model="goalDateModel"
                :label="$t('goals.form.goalDateLabel')"
              />
              <div class="sm:col-span-2">
                <AppInputGroup
                  v-model="targetTimeModel"
                  type="number"
                  :placeholder="$t('goals.form.targetTimePlaceholder')"
                  :trailing-addon="$t('ui.min')"
                  number
                  :label="$t('goals.form.targetTimeLabel')"
                />
              </div>
            </div>

            <fieldset class="mt-5">
              <legend class="text-label text-muted">
                {{ $t('goals.form.daysLabel') }}
              </legend>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="day in allDays"
                  :key="day"
                  :aria-pressed="form.preferred_days?.includes(day)"
                  class="cursor-pointer px-3 min-h-touch rounded-lg text-body border transition"
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

            <div
              class="mt-5 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <p class="text-label text-faint max-w-[48ch]">{{ $t('goals.form.note') }}</p>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  class="cursor-pointer border border-white/20 text-muted hover:text-primary px-4 py-2.5 rounded-lg text-body transition"
                  @click="resetForm"
                >
                  {{ $t('goals.form.cancel') }}
                </button>
                <button
                  :disabled="saving"
                  class="cursor-pointer bg-primary hover:bg-primaryBright disabled:opacity-50 text-background font-medium px-4 py-2.5 rounded-lg text-body transition disabled:cursor-not-allowed"
                  @click="save"
                >
                  {{ saving ? $t('goals.form.saving') : $t('goals.form.saveButton') }}
                </button>
              </div>
            </div>
            <p
              v-if="saved"
              class="mt-3 text-success text-label"
            >
              {{ $t('goals.form.saved') }}
            </p>
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
                  <span
                    class="font-mono text-label text-primary w-[36px] text-right leading-none"
                    >{{ row.value }}</span
                  >
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
                  :class="m.done ? 'bg-accent/10 border-accent' : 'bg-transparent border-white/10'"
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

        <div class="flex flex-col gap-4 w-full min-w-0">
          <div class="bg-card p-4.5 border border-white/10 rounded-xl">
            <h4 class="mb-2 font-medium text-body text-primary">
              {{ $t('goals.display.countdown_title') }}
            </h4>
            <div class="flex items-baseline gap-2">
              <span
                class="font-mono text-primary tracking-tight leading-none"
                :class="daysUntil != null ? 'text-figure' : 'text-title text-muted'"
                >{{ daysUntil ?? '—' }}</span
              >
              <span class="text-label text-muted">{{ $t('goals.display.days_to_race') }}</span>
            </div>
            <div class="mt-3 font-mono text-caption text-faint">{{ raceDateLabel }}</div>
          </div>

          <div class="bg-card p-4.5 border border-white/10 rounded-xl">
            <h4 class="mb-2 font-medium text-body text-primary">
              {{ $t('goals.display.programme') }}
            </h4>
            <div
              v-for="m in glanceMetrics"
              :key="m.label"
              class="flex justify-between items-baseline gap-4 py-2 border-b border-white/10 last:border-0 text-body"
            >
              <span class="text-faint">{{ m.label }}</span>
              <span class="font-mono text-label text-primary text-right">{{ m.value }}</span>
            </div>
          </div>

          <div class="bg-card p-4.5 border border-white/10 rounded-xl">
            <h4 class="mb-3 font-medium text-body text-primary">
              {{ $t('goals.display.best') }}
            </h4>
            <div class="flex flex-col">
              <div
                v-for="pr in prRows"
                :key="String(pr.id)"
                class="flex justify-between items-center py-2 border-b border-white/10 last:border-0"
              >
                <div class="flex flex-col gap-0.5 min-w-0">
                  <p class="font-medium text-body leading-none text-primary">{{ pr.distLabel }}</p>
                  <p class="font-normal text-label leading-none text-muted">{{ pr.dateLabel }}</p>
                </div>
                <p class="font-mono text-lead leading-none text-primary shrink-0 ml-3">
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
import { useI18n } from 'vue-i18n'

import CheckIcon from '@/components/icons/CheckIcon.vue'
import AppCalendar from '@/components/ui/AppCalendar.vue'
import AppInputGroup from '@/components/ui/AppInputGroup.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import { useGoals } from '@/features/goals/composables/useGoals.ts'

const { locale } = useI18n()

const {
  loading,
  saving,
  saved,
  weekMeta,
  goalProgress,
  goalTypeOptions,
  allDays,
  form,
  toggleDay,
  primaryTag,
  primaryTitle,
  primarySubtitle,
  daysUntil,
  countdownText,
  primaryPct,
  secondaryRows,
  milestones,
  glanceMetrics,
  prRows,
  save,
  resetForm,
} = useGoals()

const raceDateLabel = computed(() => {
  if (!goalDateModel.value) return '—'
  const d = new Date(goalDateModel.value + 'T12:00:00')
  return Number.isNaN(d.getTime())
    ? goalDateModel.value
    : d.toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
})

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
