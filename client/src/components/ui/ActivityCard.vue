<template>
  <Skeleton v-if="loading" />
  <RouterLink
    v-else
    :to="`/activities/${activityId}`"
    class="bg-card border border-white/10 rounded-2xl p-5 flex flex-col gap-5 w-full hover:border-white/20 transition"
  >
    <!-- workout-type-row 9:536 -->
    <div class="flex items-center justify-between gap-3">
      <span
        class="bg-primary/[0.13] px-2.5 py-1 rounded-md font-bold text-primary text-label tracking-wide uppercase"
        >{{ workoutLabel }}</span
      >
      <span class="flex items-center gap-1.5 shrink-0">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="dotClass"
        ></span>
        <span class="font-semibold text-muted text-body whitespace-nowrap">{{
          intensityLabel
        }}</span>
      </span>
    </div>

    <!-- workout-target-details 9:542 -->
    <div class="flex flex-col gap-1">
      <p class="leading-none">
        <span class="font-black text-white text-[48px] leading-none">{{ distanceLabel }}</span>
        <span class="font-bold text-white text-2xl leading-none"> km</span>
      </p>
      <p class="text-muted text-sm">
        {{ activity.moving_time_min ?? '—' }} {{ $t('ui.min') }} · {{ $t('ui.avg_label') }}
        <span class="font-bold text-white">{{ paceLabel }}</span>
        <span v-if="activity.avg_hr"> · {{ activity.avg_hr }} {{ $t('ui.bpm') }}</span>
      </p>
    </div>

    <!-- workout-phases 9:545 — repurposed as key metrics -->
    <div class="flex gap-3">
      <div
        class="flex-1 min-w-0 bg-background border border-white/10 rounded-card p-3 flex flex-col gap-1"
      >
        <p class="font-semibold text-muted text-caption uppercase tracking-wide leading-none">
          {{ $t('ui.distance') }}
        </p>
        <p class="font-bold text-white text-lead leading-none">{{ distanceLabel }} km</p>
        <p class="font-normal text-muted text-label leading-none truncate">{{ dateLabel }}</p>
      </div>
      <div
        class="flex-1 min-w-0 bg-primary/[0.13] border border-primary rounded-card p-3 flex flex-col gap-1"
      >
        <p class="font-semibold text-primary text-caption uppercase tracking-wide leading-none">
          {{ $t('ui.avg_pace') }}
        </p>
        <p class="font-bold text-white text-lead leading-none">{{ paceLabel }}</p>
        <p class="font-normal text-primary text-label leading-none truncate">
          {{ activity.avg_hr ? activity.avg_hr + ' ' + $t('ui.bpm_avg') : $t('ui.steady') }}
        </p>
      </div>
      <div
        class="flex-1 min-w-0 bg-background border border-white/10 rounded-card p-3 flex flex-col gap-1"
      >
        <p class="font-semibold text-muted text-caption uppercase tracking-wide leading-none">
          {{ $t('ui.time') }}
        </p>
        <p class="font-bold text-white text-lead leading-none">
          {{ activity.moving_time_min ?? '—' }} min
        </p>
        <p class="font-normal text-muted text-label leading-none truncate">
          {{
            activity.elevation_m != null
              ? activity.elevation_m + ' ' + $t('ui.m_up')
              : $t('ui.elapsed')
          }}
        </p>
      </div>
    </div>

    <!-- coaching-section 9:558 — [word-break:break-word] border-t gap-1.5 pt-3 text-muted -->
    <div class="border-t border-white/10 pt-3 flex flex-col gap-1.5 text-muted">
      <div class="flex items-center justify-between gap-2">
        <p class="font-bold text-muted text-label uppercase leading-normal w-full">
          {{ $t('ui.run_details') }}
        </p>
        <span
          v-if="trophyCount"
          class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 shrink-0"
        >
          <TrophyIcon cls="w-3.5 h-3.5 text-primary shrink-0" />
          {{ trophyCount }}
        </span>
      </div>
      <p class="font-normal text-muted text-body leading-[1.4] w-full">
        {{ dateLabel
        }}<span v-if="activity.elevation_m">
          · {{ activity.elevation_m }} {{ $t('ui.m_elev') }}</span
        ><span v-if="activity.avg_cadence"> · {{ activity.avg_cadence }} {{ $t('ui.spm') }}</span
        ><span v-if="activity.workout_type"> · {{ activity.workout_type }}</span> —
        {{ $t('ui.tap_to_view_splits_hr_and_map') }}
      </p>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import TrophyIcon from '@/components/icons/TrophyIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { i18n } from '@/i18n'
import { formatActivityPace } from '@/modules/shared/ui/format.ts'
import {
  intensityDotClass as intensityDot,
  intensityLabel as intensityText,
  workoutLabel as workoutTypeName,
} from '@/modules/shared/ui/training-vocabulary.ts'

const { locale } = useI18n()

const props = defineProps({
  activity: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})
const activityId = computed(
  () => props.activity?.id ?? props.activity?._id ?? props.activity?.provider_activity_id,
)
const dateLabel = computed(() =>
  props.activity?.date
    ? new Date(props.activity.date).toLocaleDateString(locale.value, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '',
)
const paceLabel = computed(() => formatActivityPace(props.activity))
const distanceLabel = computed(() => {
  const d = props.activity?.distance_km
  return d != null ? Number(d).toFixed(1) : '—'
})
const workoutLabel = computed(() => {
  const t = props.activity?.workout_type
  if (!t || t === 'unknown') return i18n.global.t('ui.run')
  return workoutTypeName(t)
})
const intensityLabel = computed(() => {
  // derive from workout_type; fall back to pace · HR when the type says nothing
  const label = intensityText(props.activity?.workout_type)
  if (label) return label
  return (
    paceLabel.value +
    (props.activity?.avg_hr ? ` · ${props.activity.avg_hr} ${i18n.global.t('ui.bpm')}` : '')
  )
})
const dotClass = computed(() => intensityDot(props.activity?.workout_type))
const trophyCount = computed(() => {
  const a = props.activity
  if (!a) return 0
  if (a.trophies?.length) return a.trophies.length
  if (a.achievement_count) return a.achievement_count
  return 0
})
</script>
