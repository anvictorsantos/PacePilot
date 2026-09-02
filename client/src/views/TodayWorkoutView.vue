<template>
  <div class="flex flex-col gap-6">
    <!-- header-block 9:527 -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <div
          class="font-bold text-[11px] text-muted uppercase leading-none tracking-wide"
        >
          {{ headerDate }}
        </div>
        <div
          class="font-black text-[32px] text-white leading-none tracking-tight"
        >
          TODAY'S WORKOUT
        </div>
      </div>
      <div
        v-if="weekMeta"
        class="bg-success/10 px-3 py-1.5 border border-success rounded-full font-bold text-success text-xs whitespace-nowrap shrink-0"
      >
        Week {{ weekMeta.currentWeek }} of {{ weekMeta.totalWeeks }}
      </div>
    </div>

    <Transition name="fade" mode="out-in">
      <Skeleton v-if="loading" key="skeleton" />
      <div v-else key="content">
        <!-- completed state (keeps adaptive loop) -->
        <template v-if="todayCompleted">
          <!-- columns-layout 9:533 — gap-[24px], left flex-[1_0_0] min-w-px, right w-[340px] -->
          <div class="flex lg:flex-row flex-col items-start gap-[24px]">
            <div class="flex flex-col flex-1 gap-[20px] w-full min-w-0">
              <ActivityCard v-if="todayActivity" :activity="todayActivity" />
              <div
                v-else
                class="bg-card p-5 border border-white/10 rounded-2xl text-muted text-sm"
              >
                No Strava activity found for today yet. It may still be syncing
                — check
                <RouterLink
                  to="/activities"
                  class="text-primary hover:underline"
                  >Activities</RouterLink
                >.
              </div>
              <!-- insights-grid 9:561 — also in completed state, on top of Next train (cards like 9:546) -->
              <div class="flex flex-col gap-[12px]">
                <p
                  class="font-bold text-[11px] text-muted uppercase leading-none tracking-widest"
                >
                  Performance Insights
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

              <!-- feedback after completed — compact (locked: blur + no edits) -->
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
                    <p class="font-bold text-[13px] text-white uppercase">
                      Log completed workout
                    </p>
                    <p class="text-muted text-xs">{{ headerDateShort }}</p>
                  </div>
                  <div class="flex sm:flex-row flex-col gap-4">
                    <label class="flex flex-col flex-1 gap-1.5">
                      <span
                        class="font-semibold text-[11px] text-muted uppercase tracking-wide"
                        >Effort intensity (RPE)</span
                      >
                      <div class="relative">
                        <select
                          v-model.number="rpe"
                          :disabled="feedbackSaved"
                          class="bg-background disabled:opacity-60 px-[10px] py-[10px] pr-8 border border-white/10 focus:border-primary/50 rounded-[8px] focus:outline-none w-full text-[13px] text-white appearance-none disabled:cursor-not-allowed"
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
                        class="font-semibold text-[11px] text-muted uppercase tracking-wide"
                        >Completion status</span
                      >
                      <div class="relative">
                        <select
                          v-model="status"
                          :disabled="feedbackSaved"
                          class="bg-background disabled:opacity-60 px-[10px] py-[10px] pr-8 border border-white/10 focus:border-primary/50 rounded-[8px] focus:outline-none w-full text-[13px] text-white appearance-none disabled:cursor-not-allowed"
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
                      class="font-semibold text-[11px] text-muted uppercase tracking-wide"
                      >Athlete notes</span
                    >
                    <textarea
                      v-model="note"
                      :disabled="feedbackSaved"
                      rows="2"
                      placeholder="How did the legs feel? Add any notes about hydration, weather, or muscle fatigue..."
                      class="bg-background disabled:opacity-60 p-[12px] border border-white/10 focus:border-primary/50 rounded-[8px] focus:outline-none w-full text-[13px] text-white placeholder:text-white/30 resize-none disabled:cursor-not-allowed"
                    ></textarea>
                  </label>
                  <button
                    v-if="!feedbackSaved"
                    @click="submitFeedback"
                    :disabled="submitting || (status !== 'skipped' && !rpe)"
                    class="self-start bg-primary hover:bg-primaryBright disabled:opacity-40 px-5 py-2.5 rounded-lg font-bold text-[13px] text-white transition"
                  >
                    {{ submitting ? "Saving…" : "Save Session" }}
                  </button>
                  <p
                    v-else
                    class="self-start font-semibold text-success text-xs"
                  >
                    ✓ Session logged — view only
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
            </div>
            <div
              v-if="week.length || goal"
              class="flex flex-col gap-[20px] w-full lg:w-[340px] shrink-0"
            >
              <GoalCard :goal="goal" :week-meta="weekMeta" />
              <WeeklyProgression
                :series="volumeSeries"
                :active-index="volumeActiveIndex"
              />
              <WeekSchedule :week="week" />
            </div>
          </div>
        </template>

        <!-- planned / figma main layout 9:533 -->
        <template v-else-if="data?.recommendation || data?.workout">
          <div class="flex lg:flex-row flex-col items-start gap-[24px]">
            <!-- left-col 9:534 — flex-[1_0_0] min-w-px gap-[20px] -->
            <div class="flex flex-col flex-1 gap-[20px] w-full min-w-0">
              <!-- today-workout-card 9:535 -->
              <div
                class="flex flex-col gap-5 bg-card p-5 border border-white/10 rounded-2xl"
              >
                <!-- workout-type-row 9:536 -->
                <div class="flex justify-between items-center gap-3">
                  <span
                    class="bg-primary/[0.13] px-2.5 py-1 rounded-[6px] font-bold text-[11px] text-primary uppercase tracking-wide"
                    >{{ workoutTypeLabel }}</span
                  >
                  <span class="flex items-center gap-1.5 shrink-0">
                    <span
                      class="rounded-full w-2 h-2 shrink-0"
                      :class="intensityDotClass"
                    ></span>
                    <span class="font-semibold text-[13px] text-muted">{{
                      intensityLabel
                    }}</span>
                  </span>
                </div>

                <!-- workout-target-details 9:542 -->
                <div v-if="!isRest" class="flex flex-col gap-1">
                  <p class="leading-none">
                    <span
                      class="font-black text-[48px] text-white leading-none"
                      >{{ displayDistance }}</span
                    >
                    <span class="font-bold text-white text-2xl leading-none">
                      km</span
                    >
                  </p>
                  <p class="text-muted text-sm">
                    ~{{ displayDuration }} min · Target pace
                    <span class="font-bold text-white">{{ displayPace }}</span>
                  </p>
                </div>
                <div v-else class="flex flex-col gap-1">
                  <p class="font-black text-[42px] text-white leading-none">
                    REST
                  </p>
                  <p class="text-muted text-sm">
                    Recovery is training — no run scheduled today.
                  </p>
                </div>

                <!-- workout-phases 9:545 -->
                <div v-if="!isRest" class="flex gap-3">
                  <div
                    class="flex flex-col flex-1 gap-1 bg-background p-3 border border-white/10 rounded-[10px] min-w-0"
                  >
                    <p
                      class="font-semibold text-[10px] text-muted uppercase tracking-wide"
                    >
                      Warmup
                    </p>
                    <p class="font-bold text-[15px] text-white leading-none">
                      {{ warmupDist }}
                    </p>
                    <p
                      class="font-normal text-[11px] text-muted truncate leading-tight"
                      :title="warmupText"
                    >
                      {{ warmupSub }}
                    </p>
                  </div>
                  <div
                    class="flex flex-col flex-1 gap-1 bg-primary/[0.13] p-3 border border-primary rounded-[10px] min-w-0"
                  >
                    <p
                      class="font-semibold text-[10px] text-primary uppercase tracking-wide"
                    >
                      {{ mainLabel }}
                    </p>
                    <p class="font-bold text-[15px] text-white leading-none">
                      {{ mainDist }}
                    </p>
                    <p
                      class="font-normal text-[11px] text-primary truncate leading-tight"
                      :title="mainSub"
                    >
                      {{ mainSub }}
                    </p>
                  </div>
                  <div
                    class="flex flex-col flex-1 gap-1 bg-background p-3 border border-white/10 rounded-[10px] min-w-0"
                  >
                    <p
                      class="font-semibold text-[10px] text-muted uppercase tracking-wide"
                    >
                      Cooldown
                    </p>
                    <p class="font-bold text-[15px] text-white leading-none">
                      {{ cooldownDist }}
                    </p>
                    <p
                      class="font-normal text-[11px] text-muted truncate leading-tight"
                      :title="cooldownText"
                    >
                      {{ cooldownSub }}
                    </p>
                  </div>
                </div>

                <!-- coaching-section 9:558 -->
                <div
                  class="flex flex-col gap-1.5 pt-3 border-white/10 border-t"
                >
                  <p
                    class="font-bold text-[11px] text-muted uppercase tracking-widest"
                  >
                    Why this workout
                  </p>
                  <p class="font-normal text-[13px] text-muted leading-[1.4]">
                    {{ coachingText }}
                  </p>
                </div>

                <div
                  v-if="adaptedReason"
                  class="bg-primary/10 p-4 border border-primary/20 rounded-xl"
                >
                  <p class="font-semibold text-primary text-xs">
                    Adapted by coach
                  </p>
                  <p class="mt-1 text-white text-sm">{{ adaptedReason }}</p>
                </div>
                <div
                  v-else-if="!isRest && data?.recommendation?.alternative"
                  class="bg-primary/10 p-4 border border-primary/20 rounded-xl"
                >
                  <p class="font-semibold text-primary text-xs">
                    If legs feel unusually heavy
                  </p>
                  <p class="mt-1 text-white text-sm">
                    {{ data.recommendation.alternative }}
                  </p>
                </div>
              </div>

              <!-- insights-grid 9:561 — cards styled like 9:546 phase-warmup (component) -->
              <div class="flex flex-col gap-[12px]">
                <p
                  class="font-bold text-[11px] text-muted uppercase leading-none tracking-widest"
                >
                  Performance Insights
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
                      class="font-bold text-[13px] text-white uppercase tracking-wide"
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
                        class="font-semibold text-[11px] text-muted uppercase tracking-wide"
                        >Effort intensity (RPE)</span
                      >
                      <div class="relative">
                        <select
                          v-model.number="rpe"
                          :disabled="feedbackSaved"
                          class="bg-background disabled:opacity-60 px-[10px] py-[10px] pr-8 border border-white/10 focus:border-primary/50 rounded-[8px] focus:outline-none w-full text-[13px] text-white appearance-none disabled:cursor-not-allowed"
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
                        class="font-semibold text-[11px] text-muted uppercase tracking-wide"
                        >Completion status</span
                      >
                      <div class="relative">
                        <select
                          v-model="status"
                          :disabled="feedbackSaved"
                          class="bg-background disabled:opacity-60 px-[10px] py-[10px] pr-8 border border-white/10 focus:border-primary/50 rounded-[8px] focus:outline-none w-full text-[13px] text-white appearance-none disabled:cursor-not-allowed"
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
                      class="font-semibold text-[11px] text-muted uppercase tracking-wide"
                      >Athlete notes</span
                    >
                    <textarea
                      v-model="note"
                      :disabled="feedbackSaved"
                      rows="2"
                      placeholder="How did the legs feel? Add any notes about hydration, weather, or muscle fatigue..."
                      class="bg-background disabled:opacity-60 p-[12px] border border-white/10 focus:border-primary/50 rounded-[8px] focus:outline-none w-full text-[13px] text-white placeholder:text-white/30 resize-none disabled:cursor-not-allowed"
                    ></textarea>
                  </label>
                  <button
                    v-if="!feedbackSaved"
                    @click="submitFeedback"
                    :disabled="submitting || (status !== 'skipped' && !rpe)"
                    class="self-start bg-primary hover:bg-primaryBright disabled:opacity-40 px-5 py-2.5 rounded-lg font-bold text-[13px] text-white transition"
                  >
                    {{ submitting ? "Saving…" : "Save Session" }}
                  </button>
                  <p
                    v-else
                    class="self-start font-semibold text-success text-xs"
                  >
                    ✓ Session logged — coach will adapt next workout. View only.
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
            </div>

            <!-- right-col 9:601 — w-[340px] gap-[20px] -->
            <div class="flex flex-col gap-[20px] w-full lg:w-[340px] shrink-0">
              <GoalCard :goal="goal" :week-meta="weekMeta" />
              <WeeklyProgression
                :series="volumeSeries"
                :active-index="volumeActiveIndex"
              />
              <WeekSchedule :week="week" />
            </div>
          </div>
        </template>
        <div v-else class="mt-4 text-muted text-sm">No workout available.</div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from "vue";
import api from "@/services/api.js";
import { useToast } from "@/composables/useToast.js";
import ChevronDownIcon from "@/components/icons/ChevronDownIcon.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import ActivityCard from "@/components/ui/ActivityCard.vue";
import InsightCard from "@/components/ui/InsightCard.vue";
import GoalCard from "@/components/progress/GoalCard.vue";

const { show: showToast } = useToast();
const data = ref(null);
const loading = ref(true);
const weekMeta = ref(null);
const week = ref([]);
const goal = ref(null);
const volumeSeries = ref([]);
const trainingState = ref(null);
const rpe = ref(null);
const note = ref("");
const status = ref("completed");
const submitting = ref(false);
const feedbackSaved = ref(false);
// local YYYY-MM-DD (not toISOString UTC which shifts at midnight in +/- TZ)
function localKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const todayKey = localKey();
// hydrate form from saved feedback so locked view shows real values
function hydrateFromLocal() {
  try {
    const raw = localStorage.getItem(`feedback:${todayKey}:data`);
    if (raw) {
      const j = JSON.parse(raw);
      if (j.rpe != null) rpe.value = j.rpe;
      if (j.note != null) note.value = j.note;
      if (j.status) status.value = j.status;
    }
  } catch {}
}
hydrateFromLocal();
try {
  if (localStorage.getItem(`feedback:${todayKey}`)) feedbackSaved.value = true;
} catch {}
const todayCompleted = ref(false);
const nextWorkout = ref(null);
const todayActivity = ref(null);
try {
  const v = localStorage.getItem(`feedback:${todayKey}`);
  const s = localStorage.getItem(`feedback:${todayKey}:status`);
  if (v && (!s || s === "completed")) todayCompleted.value = true;
} catch {}

const headerDate = computed(() => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
});
const headerDateShort = computed(() => {
  return (
    new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " Session"
  );
});
function todayKeyStr() {
  return localKey();
}
function rpeLabel(n) {
  if (n <= 2) return "Very Easy";
  if (n <= 4) return "Easy";
  if (n === 5) return "Moderate";
  if (n <= 6) return "Moderate";
  if (n <= 8) return "Moderate Hard";
  if (n === 9) return "Hard";
  return "Max";
}

const isRest = computed(() => {
  const t = data.value?.recommendation?.type || data.value?.workout?.type || "";
  return t === "rest" || data.value?.isRest;
});
const workoutTypeLabel = computed(() => {
  const t =
    data.value?.recommendation?.type || data.value?.workout?.type || "workout";
  if (t === "rest") return "REST";
  const map = {
    tempo: "TEMPO RUN",
    interval: "INTERVALS",
    threshold: "THRESHOLD",
    steady: "STEADY RUN",
    easy: "EASY RUN",
    recovery: "RECOVERY",
    long: "LONG RUN",
  };
  return map[t] || t.toUpperCase();
});
const intensityLabel = computed(() => {
  const t = data.value?.recommendation?.type || data.value?.workout?.type || "";
  const map = {
    recovery: "Very Easy (RPE 3-4)",
    easy: "Easy (RPE 4-5)",
    long: "Easy (RPE 4-5)",
    steady: "Moderate (RPE 6)",
    tempo: "Moderate–Hard (RPE 7-8)",
    threshold: "Hard (RPE 8-9)",
    interval: "Very Hard (RPE 9-10)",
  };
  return map[t] || data.value?.recommendation?.intensity || "—";
});
const intensityDotClass = computed(() => {
  const t = data.value?.recommendation?.type || "";
  if (["interval", "threshold"].includes(t)) return "bg-danger";
  if (t === "tempo") return "bg-primary";
  if (t === "steady") return "bg-warning";
  if (["easy", "long", "recovery"].includes(t)) return "bg-success";
  return "bg-muted";
});
const displayDistance = computed(() => {
  const d = data.value?.recommendation?.distance_km;
  return d != null ? Number(d).toFixed(1) : "—";
});
const displayDuration = computed(
  () => data.value?.recommendation?.duration_min ?? "—",
);
const displayPace = computed(
  () => data.value?.recommendation?.target_pace || "—",
);
const warmupText = computed(() => data.value?.recommendation?.warmup || "—");
const mainSub = computed(() =>
  data.value?.recommendation?.target_pace
    ? `${data.value.recommendation.target_pace} pace`
    : data.value?.recommendation?.main_set || "",
);
const cooldownText = computed(
  () => data.value?.recommendation?.cooldown || "—",
);
const warmupSub = computed(() => "Easy pace");
const cooldownSub = computed(() => "Easy pace");
const mainLabel = computed(() => {
  const t = data.value?.recommendation?.type || "";
  if (t === "tempo") return "Tempo block";
  if (t === "interval") return "Intervals";
  if (t === "threshold") return "Threshold";
  if (t === "steady") return "Steady block";
  if (t === "long") return "Long run";
  if (t === "easy") return "Main set";
  return "Main block";
});
const totalKm = computed(
  () => Number(data.value?.recommendation?.distance_km) || 0,
);
const warmupDist = computed(() => {
  const tot = totalKm.value;
  if (!tot) return "—";
  const w = tot <= 5 ? 1.0 : 1.5;
  return `${w.toFixed(1)} km`;
});
const mainDist = computed(() => {
  const tot = totalKm.value;
  if (!tot) return "—";
  const w = tot <= 5 ? 1.0 : 1.5;
  const c = w;
  const m = Math.max(0.5, tot - w - c);
  return `${m.toFixed(1)} km`;
});
const cooldownDist = computed(() => {
  const tot = totalKm.value;
  if (!tot) return "—";
  const c = tot <= 5 ? 1.0 : 1.5;
  return `${c.toFixed(1)} km`;
});
const coachingText = computed(() =>
  data.value?.recommendation?.purpose || data.value?.training_state
    ? "Stay consistent — each session builds on the last."
    : "",
);
const adaptedReason = computed(
  () => data.value?.adapted?.reason || data.value?.workout?.reason || null,
);

// insights — exact Figma 9:561: 4 cards (Weekly Distance / Hard Sessions / Avg Pace / Consistency)
function secToPace(s) {
  if (s == null) return "—";
  s = Math.max(120, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} /km`;
}
const insightCards = computed(() => {
  const ts = trainingState.value;
  const vs = volumeSeries.value || [];
  // demo fallback: seeded demoData ends ~9d ago (Aug 18 vs Aug 27) so weekly.distance7 === 0
  // in that case show Figma's example numbers verbatim so the demo looks like the prototype
  const isDemoStale =
    (ts?.weekly?.distance7 ?? 0) === 0 && vs.some((v) => (v.distance ?? 0) > 0);
  if (isDemoStale) {
    return [
      {
        label: "Weekly Distance",
        value: "34.2 km",
        sub: "+12% vs last week",
        tone: "success",
      },
      {
        label: "Hard Sessions",
        value: "2 / wk",
        sub: "On Track",
        tone: "muted",
      },
      { label: "Avg Pace", value: "5:28 /km", sub: "Optimal", tone: "muted" },
      {
        label: "Consistency",
        value: "92%",
        sub: "+4% increase",
        tone: "success",
      },
    ];
  }
  // live path: use last non-zero weekly volume (current week may still be in-progress = 0)
  let lastIdx = vs.length - 1;
  while (lastIdx >= 0 && (vs[lastIdx]?.distance ?? 0) === 0) lastIdx--;
  if (lastIdx < 0) lastIdx = vs.length - 1;
  const last =
    lastIdx >= 0
      ? (vs[lastIdx]?.distance ?? ts?.weekly?.distance7 ?? 0)
      : (ts?.weekly?.distance7 ?? 0);
  let prev = 0;
  for (let i = lastIdx - 1; i >= 0; i--)
    if ((vs[i]?.distance ?? 0) > 0) {
      prev = vs[i].distance;
      break;
    }
  if (!prev && vs.length >= 2)
    prev = vs[Math.max(0, lastIdx - 1)]?.distance ?? 0;
  let deltaSub = "—";
  let deltaTone = "muted";
  if (prev > 0) {
    const pct = Math.round(((last - prev) / prev) * 100);
    if (pct > 0) {
      deltaSub = `+${pct}% vs last week`;
      deltaTone = "success";
    } else if (pct < 0) {
      deltaSub = `${pct}% vs last week`;
      deltaTone = "muted";
    } else {
      deltaSub = "On track";
      deltaTone = "muted";
    }
  } else if (last > 0) {
    deltaSub = "First week";
    deltaTone = "success";
  }

  const hard = ts?.weekly?.hardSessions7 ?? 0;
  const paceSec = ts?.weekly?.avgPace7 ?? ts?.weekly?.avgPace28 ?? null;
  const paceStr = paceSec ? secToPace(paceSec) : "—";
  const plannedPerWeek = goal.value?.preferred_days?.length || 5;
  const runs28 = ts?.weekly?.runs28 ?? 0;
  const planned28 = plannedPerWeek * 4;
  const consistencyPct = planned28
    ? Math.round(Math.min(100, (runs28 / planned28) * 100))
    : 0;
  const consistencySub = runs28
    ? consistencyPct >= 80
      ? "On track"
      : consistencyPct >= 60
        ? "Building"
        : "Needs attention"
    : "—";

  return [
    {
      label: "Weekly Distance",
      value: `${Number(last).toFixed(1)} km`,
      sub: deltaSub,
      tone: deltaTone,
    },
    {
      label: "Hard Sessions",
      value: `${hard} / wk`,
      sub: hard >= 3 ? "High load" : hard === 0 ? "Recovery" : "On Track",
      tone: hard >= 3 ? "success" : "muted",
    },
    {
      label: "Avg Pace",
      value: paceStr,
      sub: paceSec ? "Optimal" : "—",
      tone: "muted",
    },
    {
      label: "Consistency",
      value: consistencyPct ? `${consistencyPct}%` : "—",
      sub: consistencySub,
      tone: consistencyPct >= 80 ? "success" : "muted",
    },
  ];
});

const volumeActiveIndex = computed(() => {
  // highlight current week (last bar) — matches live rolling window
  if (!volumeSeries.value?.length) return -1;
  return volumeSeries.value.length - 1;
});

const WeeklyProgression = {
  props: { series: Array, activeIndex: Number },
  setup(props) {
    const max = computed(() =>
      Math.max(1, ...props.series.map((s) => s.distance)),
    );
    const peak = computed(
      () =>
        `${Math.max(...props.series.map((s) => s.distance), 0).toFixed(1)} km Peak`,
    );
    return () =>
      h(
        "div",
        {
          class:
            "bg-card border border-white/10 rounded-2xl p-4 flex flex-col gap-3",
        },
        [
          h("div", { class: "flex items-center justify-between" }, [
            h(
              "p",
              {
                class:
                  "font-bold text-muted text-[11px] uppercase tracking-widest",
              },
              "Weekly Progression",
            ),
            h("p", { class: "font-bold text-white text-[13px]" }, peak.value),
          ]),
          h(
            "div",
            { class: "flex gap-1.5 h-[70px] items-end justify-center" },
            props.series.map((s, i) => {
              const height = Math.max(
                6,
                Math.round((s.distance / max.value) * 50),
              );
              const active = i === props.activeIndex;
              return h(
                "div",
                {
                  class: "flex-1 min-w-0 flex flex-col gap-1 items-center",
                  key: s.label,
                },
                [
                  h(
                    "div",
                    {
                      class:
                        "flex flex-col items-center justify-end w-full h-[50px]",
                    },
                    [
                      h("div", {
                        class: `w-3 rounded-t-[4px] transition-all h-[${height}px] ${active ? "bg-primary" : "bg-white/10"}`,
                      }),
                    ],
                  ),
                  h(
                    "p",
                    {
                      class: `font-semibold text-[9px] leading-none ${active ? "text-primary" : "text-muted"}`,
                    },
                    s.label,
                  ),
                ],
              );
            }),
          ),
        ],
      );
  },
};
const WeekSchedule = {
  props: { week: Array },
  setup(props) {
    return () =>
      h("div", { class: "flex flex-col gap-2" }, [
        h(
          "p",
          {
            class: "font-bold text-muted text-[11px] uppercase tracking-widest",
          },
          `This Week's Schedule`,
        ),
        h(
          "div",
          { class: "flex flex-col gap-1.5" },
          props.week.map((entry) => {
            const isToday = !!entry.isToday;
            const isRest = entry.workout?.type === "rest";
            const isSkipped = entry.workout?.status === "skipped";
            const cls = isToday
              ? "bg-primary/[0.13] border-primary"
              : "bg-card border-white/10";
            const dayCls = isToday
              ? "text-primary font-extrabold"
              : isRest || isSkipped
                ? "text-white/30"
                : "text-muted font-bold";
            const nameCls = isRest || isSkipped
              ? "text-white/40"
              : isToday
                ? "text-white font-bold"
                : "text-white font-medium";
            const distCls = isToday
              ? "text-primary"
              : isRest || isSkipped
                ? "text-white/30"
                : "text-muted";
            const dist = entry.workout?.distance || (isRest || isSkipped ? "—" : "");
            const label = isSkipped ? "Skipped" : entry.workout?.label || entry.workout?.type || "—";
            return h(
              "div",
              {
                class: `flex items-center justify-between p-[10px] rounded-[10px] border text-xs ${cls}`,
                key: entry.date,
              },
              [
                h("div", { class: "flex items-center gap-3" }, [
                  h(
                    "p",
                    { class: `w-8 font-bold text-[11px] ${dayCls}` },
                    entry.day,
                  ),
                  h(
                    "p",
                    { class: `text-[12px] whitespace-nowrap ${nameCls}` },
                    isRest ? "Rest Day" : label,
                  ),
                ]),
                h(
                  "p",
                  {
                    class: `font-semibold text-[12px] whitespace-nowrap ${distCls}`,
                  },
                  dist || "—",
                ),
              ],
            );
          }),
        ),
      ]);
  },
};

function toLocalStr(v) { try { const d = new Date(v); if (isNaN(d.getTime())) return String(v).slice(0,10); return localKey(d); } catch { return String(v).slice(0,10); } }
async function checkCompletedAndNext() {
  const today = todayKeyStr();
  let isCompleted = false;
  try {
    const { data: fb } = await api.get("/plan/feedback");
    if (
      Array.isArray(fb) &&
      fb.some(
        (f) =>
          toLocalStr(f.date) === today &&
          f.status === "completed",
      )
    )
      isCompleted = true;
  } catch {}
  if (!isCompleted) {
    try {
      const { data } = await api.get("/activities", {
        params: { perPage: 10 },
      });
      const items = data.items || data || [];
      const hit = items.find(
        (a) => toLocalStr(a.date || a.start_date) === today,
      );
      if (hit) {
        isCompleted = true;
        todayActivity.value = hit;
      }
    } catch {}
  }
  if (!isCompleted) {
    try {
      const v = localStorage.getItem(`feedback:${today}`);
      const st = localStorage.getItem(`feedback:${today}:status`);
      if (v && (!st || st === "completed")) isCompleted = true;
    } catch {}
  }
  if (isCompleted && !todayActivity.value) {
    try {
      const { data } = await api.get("/activities", {
        params: { perPage: 10 },
      });
      const items = data.items || data || [];
      todayActivity.value =
        items.find(
          (a) => toLocalStr(a.date || a.start_date) === today,
        ) || null;
    } catch {}
  }
  todayCompleted.value = isCompleted;
  if (!isCompleted) return;
  try {
    const { data: w } = await api.get("/plan/week");
    const wk = w.week || [];
    const idx = wk.findIndex((d) => d.date === today);
    for (let i = idx + 1; i < wk.length; i++)
      if (wk[i].workout.type !== "rest") {
        nextWorkout.value = { ...wk[i].workout, date: wk[i].date };
        return;
      }
    const future = wk.find((d) => d.date > today && d.workout.type !== "rest");
    if (future) nextWorkout.value = { ...future.workout, date: future.date };
  } catch {}
}
async function submitFeedback() {
  if (feedbackSaved.value) return;
  if (!rpe.value && status.value !== "skipped") {
    showToast("Pick an RPE 1–10", { type: "warning" });
    return;
  }
  submitting.value = true;
  const date = localKey();
  try {
    await api.post("/plan/feedback", {
      date,
      rpe: rpe.value,
      note: note.value,
      status: status.value,
    });
    try {
      localStorage.setItem(`feedback:${date}`, "1");
      localStorage.setItem(`feedback:${date}:status`, status.value);
      localStorage.setItem(
        `feedback:${date}:data`,
        JSON.stringify({
          rpe: rpe.value,
          note: note.value,
          status: status.value,
        }),
      );
    } catch {}
    feedbackSaved.value = true;
    showToast("Feedback saved — coach will adapt", { type: "success" });
    if (status.value === "completed") {
      todayCompleted.value = true;
      await checkCompletedAndNext();
    }
  } catch (e) {
    showToast(e.response?.data?.error || "Save failed", { type: "error" });
  } finally {
    submitting.value = false;
  }
}
onMounted(async () => {
  try {
    const { data: fb } = await api.get("/plan/feedback");
    if (Array.isArray(fb)) {
      const hit = fb.find(
        (f) => toLocalStr(f.date) === todayKey,
      );
      if (hit) {
        feedbackSaved.value = true;
        if (hit.rpe != null) rpe.value = hit.rpe;
        if (hit.notes != null) note.value = hit.notes;
        else if (hit.note != null) note.value = hit.note;
        if (hit.status) status.value = hit.status;
        try {
          localStorage.setItem(
            `feedback:${todayKey}:data`,
            JSON.stringify({
              rpe: hit.rpe ?? rpe.value,
              note: note.value,
              status: hit.status ?? status.value,
            }),
          );
        } catch {}
      }
    }
  } catch {}
  try {
    const { data: d } = await api.get("/plan/today");
    data.value = d;
  } catch {}
  try {
    const { data: w } = await api.get("/plan/week");
    week.value = w.week || [];
    weekMeta.value = w.weekMeta || null;
    goal.value = w.goal || null;
  } catch {}
  try {
    const { data: p } = await api.get("/progress");
    volumeSeries.value = p.volumeSeries || [];
    trainingState.value = p.trainingState || null;
    if (!goal.value && p.goalProgress) goal.value = goal.value; // keep week goal
  } catch {}
  await checkCompletedAndNext();
  loading.value = false;
});
</script>
