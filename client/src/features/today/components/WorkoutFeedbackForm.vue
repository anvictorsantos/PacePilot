<template>
  <!-- feedback-section 9:580 — locked: shows saved values, view-only (no blur) -->
  <div
    class="relative flex flex-col gap-4 bg-card p-4 border border-white/10 rounded-2xl overflow-hidden"
  >
    <div
      :class="feedbackSaved ? 'pointer-events-none select-none opacity-70' : ''"
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
              :disabled="feedbackSaved"
              class="bg-background disabled:opacity-60 px-2.5 py-2.5 pr-8 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-none w-full text-body text-white appearance-none disabled:cursor-not-allowed"
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
              :disabled="feedbackSaved"
              class="bg-background disabled:opacity-60 px-2.5 py-2.5 pr-8 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-none w-full text-body text-white appearance-none disabled:cursor-not-allowed"
            >
              <option value="completed">{{ $t('ui.completed_as_planned') }}</option>
              <option value="skipped">{{ $t('ui.skipped') }}</option>
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
          :disabled="feedbackSaved"
          rows="2"
          :placeholder="
            $t('ui.how_did_the_legs_feel_add_any_notes_about_hydration_weather_or_muscle_fatigue')
          "
          class="bg-background disabled:opacity-60 p-3 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-none w-full text-body text-white placeholder:text-white/30 resize-none disabled:cursor-not-allowed"
        ></textarea>
      </label>
      <button
        v-if="!feedbackSaved"
        :disabled="submitting || (status !== 'skipped' && !rpe)"
        class="self-start bg-primary hover:bg-primaryBright disabled:opacity-40 px-5 py-2.5 rounded-lg font-bold text-body text-white transition"
        @click="$emit('submit')"
      >
        {{ submitting ? 'Saving…' : 'Save Session' }}
      </button>
      <p
        v-else
        class="self-start font-semibold text-success text-xs"
      >
        {{ savedMessage }}
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
import ChevronDownIcon from '@/components/icons/ChevronDownIcon.vue'

const rpe = defineModel<number | null>('rpe')
const status = defineModel<string>('status')
const note = defineModel<string>('note')
defineProps({
  feedbackSaved: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  headerDateShort: { type: String, default: '' },
  savedMessage: { type: String, default: '' },
})
defineEmits(['submit'])
function rpeLabel(n: number) {
  if (n <= 2) return 'Very Easy'
  if (n <= 4) return 'Easy'
  if (n === 5) return 'Moderate'
  if (n <= 6) return 'Moderate'
  if (n <= 8) return 'Moderate Hard'
  if (n === 9) return 'Hard'
  return 'Max'
}
</script>
