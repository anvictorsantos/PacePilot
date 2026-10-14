<template>
  <!-- feedback-section 9:580 — locked: shows saved values, view-only (no blur) -->
  <div
    class="relative flex flex-col gap-4 bg-card p-4 border border-white/10 rounded-2xl overflow-hidden"
  >
    <div
      :class="
        feedbackSaved
          ? 'pointer-events-none select-none opacity-70'
          : ''
      "
      class="flex flex-col gap-4"
    >
      <div class="flex justify-between items-center">
        <p
          class="font-bold text-body text-white uppercase tracking-wide"
        >
          Log completed workout
        </p>
        <p class="font-normal text-muted text-xs">
          {{ headerDateShort }}
        </p>
      </div>
      <div class="flex sm:flex-row flex-col gap-4">
        <label class="flex flex-col flex-1 gap-1.5">
          <span
            class="font-semibold text-label text-muted uppercase tracking-wide"
            >Effort intensity (RPE)</span
          >
          <div class="relative">
            <select
              v-model.number="rpe"
              :disabled="feedbackSaved"
              class="bg-background disabled:opacity-60 px-2.5 py-2.5 pr-8 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-none w-full text-body text-white appearance-none disabled:cursor-not-allowed"
            >
              <option :value="null" disabled>Select effort</option>
              <option v-for="n in 10" :key="n" :value="n">
                {{ n }} - {{ rpeLabel(n) }}
              </option>
            </select>
            <ChevronDownIcon
              cls="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>
        </label>
        <label class="flex flex-col flex-1 gap-1.5">
          <span
            class="font-semibold text-label text-muted uppercase tracking-wide"
            >Completion status</span
          >
          <div class="relative">
            <select
              v-model="status"
              :disabled="feedbackSaved"
              class="bg-background disabled:opacity-60 px-2.5 py-2.5 pr-8 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-none w-full text-body text-white appearance-none disabled:cursor-not-allowed"
            >
              <option value="completed">
                Completed as planned
              </option>
              <option value="skipped">Skipped</option>
            </select>
            <ChevronDownIcon
              cls="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>
        </label>
      </div>
      <label class="flex flex-col gap-1.5">
        <span
          class="font-semibold text-label text-muted uppercase tracking-wide"
          >Athlete notes</span
        >
        <textarea
          v-model="note"
          :disabled="feedbackSaved"
          rows="2"
          placeholder="How did the legs feel? Add any notes about hydration, weather, or muscle fatigue..."
          class="bg-background disabled:opacity-60 p-3 border border-white/10 focus:border-primary/50 rounded-lg focus:outline-none w-full text-body text-white placeholder:text-white/30 resize-none disabled:cursor-not-allowed"
        ></textarea>
      </label>
      <button
        v-if="!feedbackSaved"
        @click="$emit('submit')"
        :disabled="submitting || (status !== 'skipped' && !rpe)"
        class="self-start bg-primary hover:bg-primaryBright disabled:opacity-40 px-5 py-2.5 rounded-lg font-bold text-body text-white transition"
      >
        {{ submitting ? "Saving…" : "Save Session" }}
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
<script setup>
import ChevronDownIcon from "@/components/icons/ChevronDownIcon.vue";

const rpe = defineModel("rpe");
const status = defineModel("status");
const note = defineModel("note");
defineProps({
  feedbackSaved: Boolean,
  submitting: Boolean,
  headerDateShort: String,
  savedMessage: String,
});
defineEmits(["submit"]);
function rpeLabel(n) {
  if (n <= 2) return "Very Easy";
  if (n <= 4) return "Easy";
  if (n === 5) return "Moderate";
  if (n <= 6) return "Moderate";
  if (n <= 8) return "Moderate Hard";
  if (n === 9) return "Hard";
  return "Max";
}
</script>
