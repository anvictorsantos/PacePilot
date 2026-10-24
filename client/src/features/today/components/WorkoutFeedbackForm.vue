<template>
  <!-- feedback-section 9:580 — locked: shows saved values, view-only (no blur) -->
  <div
    class="relative flex flex-col gap-4 bg-card p-4 border border-white/10 rounded-2xl overflow-hidden"
  >
    <div
      :class="feedbackSaved || restDay ? 'pointer-events-none select-none opacity-70' : ''"
      class="flex flex-col gap-4"
    >
      <div class="flex justify-between items-center">
        <p class="font-bold text-body text-white uppercase tracking-wide">
          {{ $t('ui.log_completed_workout') }}
        </p>
        <p class="font-normal text-muted text-xs">
          {{ headerDateShort }}
        </p>
      </div>
      <div class="flex sm:flex-row flex-col gap-4">
        <label
          for="feedback-rpe"
          class="flex flex-col flex-1 gap-1.5"
        >
          <span class="font-semibold text-label text-muted uppercase tracking-wide">{{
            $t('ui.effort_intensity_rpe')
          }}</span>
          <div class="relative">
            <select
              id="feedback-rpe"
              v-model.number="rpe"
              :disabled="feedbackSaved || restDay"
              class="bg-background disabled:opacity-60 px-2.5 py-2.5 pr-8 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-hidden w-full text-body text-white appearance-none disabled:cursor-not-allowed"
            >
              <option
                :value="null"
                disabled
              >
                {{ $t('ui.select_effort') }}
              </option>
              <option
                v-for="n in 10"
                :key="n"
                :value="n"
              >
                {{ n }} - {{ rpeLabel(n) }}
              </option>
            </select>
            <ChevronDownIcon
              cls="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>
        </label>
        <label
          for="feedback-status"
          class="flex flex-col flex-1 gap-1.5"
        >
          <span class="font-semibold text-label text-muted uppercase tracking-wide">{{
            $t('ui.completion_status')
          }}</span>
          <div class="relative">
            <select
              id="feedback-status"
              v-model="status"
              :disabled="feedbackSaved || restDay"
              class="bg-background disabled:opacity-60 px-2.5 py-2.5 pr-8 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-hidden w-full text-body text-white appearance-none disabled:cursor-not-allowed"
            >
              <option :value="FeedbackStatus.Completed">{{ $t('ui.completed_as_planned') }}</option>
              <option :value="FeedbackStatus.Skipped">{{ $t('ui.skipped') }}</option>
            </select>
            <ChevronDownIcon
              cls="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>
        </label>
      </div>
      <label
        for="feedback-note"
        class="flex flex-col gap-1.5"
      >
        <span class="font-semibold text-label text-muted uppercase tracking-wide">{{
          $t('ui.athlete_notes')
        }}</span>
        <textarea
          id="feedback-note"
          v-model="note"
          :disabled="feedbackSaved || restDay"
          rows="2"
          :maxlength="FEEDBACK_NOTE_MAX_CHARS"
          aria-describedby="feedback-note-count"
          :placeholder="
            $t('ui.how_did_the_legs_feel_add_any_notes_about_hydration_weather_or_muscle_fatigue')
          "
          class="bg-background disabled:opacity-60 p-3 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-hidden w-full text-body text-white placeholder:text-white/30 resize-none disabled:cursor-not-allowed"
        ></textarea>
        <span
          id="feedback-note-count"
          class="self-end text-caption text-faint"
        >
          {{ $t('ui.feedback_note_count', { count: noteLength, max: FEEDBACK_NOTE_MAX_CHARS }) }}
        </span>
      </label>
      <button
        v-if="!feedbackSaved && !restDay"
        :disabled="submitting || (status !== 'skipped' && !rpe)"
        class="self-start bg-primary hover:bg-primaryBright disabled:opacity-40 px-5 py-2.5 rounded-lg font-bold text-body text-white transition"
        @click="$emit('submit')"
      >
        {{ submitting ? $t('common.saving') : $t('landing.sections.today.saveAction') }}
      </button>
      <p
        v-else-if="feedbackSaved"
        class="self-start font-semibold text-success text-xs"
      >
        {{ savedMessage }}
      </p>
      <p
        v-else-if="restDay"
        class="self-start font-semibold text-muted text-xs"
      >
        {{ $t('ui.rest_day_nothing_to_log') }}
      </p>
    </div>
    <div
      v-if="feedbackSaved"
      class="absolute inset-0 cursor-not-allowed"
      aria-hidden="true"
      @click.prevent
      @mousedown.prevent
    ></div>
  </div>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue'

import ChevronDownIcon from '@/components/icons/ChevronDownIcon.vue'
import { i18n } from '@/i18n'
import { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import { Rpe } from '@/modules/feedback/domain/value-object/Rpe.ts'
import { FEEDBACK_NOTE_MAX_CHARS } from '@/modules/feedback/infrastructure/dto/PlanFeedback.ts'

const rpe = defineModel<number | null>('rpe')
const status = defineModel<FeedbackStatus>('status')
const note = defineModel<string>('note')

// A draft restored from the run-day cache can predate the cap, and `maxlength`
// does not trim a value that is set programmatically.
watch(
  note,
  (value) => {
    if (value && value.length > FEEDBACK_NOTE_MAX_CHARS) {
      note.value = value.slice(0, FEEDBACK_NOTE_MAX_CHARS)
    }
  },
  { immediate: true },
)

const noteLength = computed(() => (note.value ?? '').length)
defineProps({
  feedbackSaved: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  headerDateShort: { type: String, default: '' },
  savedMessage: { type: String, default: '' },
  restDay: { type: Boolean, default: false },
})
defineEmits(['submit'])
function rpeLabel(n: number): string {
  const rpe = Rpe.from(n)
  return rpe ? i18n.global.t(rpe.labelKey()) : ''
}
</script>
