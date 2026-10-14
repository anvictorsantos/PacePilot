<template>
  <div class="flex flex-col gap-6">
    <!-- header-block 9:527 -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <div
          class="font-bold text-label text-muted uppercase leading-none tracking-wide"
        >
          {{ headerDate }}
        </div>
        <div
          class="font-black text-h2 text-white leading-none tracking-tight"
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
          <!-- columns-layout 9:533 — gap-6, left flex-[1_0_0] min-w-px, right w-[340px] -->
          <div class="flex lg:flex-row flex-col items-start gap-6">
            <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
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
              <div class="flex flex-col gap-3">
                <p
                  class="font-bold text-label text-muted uppercase leading-none tracking-widest"
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
              <WorkoutFeedbackForm
                v-model:rpe="rpe"
                v-model:status="status"
                v-model:note="note"
                :feedback-saved="feedbackSaved"
                :submitting="submitting"
                :header-date-short="headerDateShort"
                saved-message="✓ Session logged — view only"
                @submit="submitFeedback"
              />
            </div>
            <div
              v-if="week.length || goal"
              class="flex flex-col gap-5 w-full lg:w-[340px] shrink-0"
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
          <div class="flex lg:flex-row flex-col items-start gap-6">
            <!-- left-col 9:534 — flex-[1_0_0] min-w-px gap-5 -->
            <div class="flex flex-col flex-1 gap-5 w-full min-w-0">
              <!-- today-workout-card 9:535 -->
              <div
                class="flex flex-col gap-5 bg-card p-5 border border-white/10 rounded-2xl"
              >
                <!-- workout-type-row 9:536 -->
                <div class="flex justify-between items-center gap-3">
                  <span
                    class="bg-primary/[0.13] px-2.5 py-1 rounded-md font-bold text-label text-primary uppercase tracking-wide"
                    >{{ workoutTypeLabel }}</span
                  >
                  <span class="flex items-center gap-1.5 shrink-0">
                    <span
                      class="rounded-full w-2 h-2 shrink-0"
                      :class="intensityDotClass"
                    ></span>
                    <span class="font-semibold text-body text-muted">{{
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
                    class="flex flex-col flex-1 gap-1 bg-background p-3 border border-white/10 rounded-card min-w-0"
                  >
                    <p
                      class="font-semibold text-caption text-muted uppercase tracking-wide"
                    >
                      Warmup
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
                      class="font-semibold text-caption text-primary uppercase tracking-wide"
                    >
                      {{ mainLabel }}
                    </p>
                    <p class="font-bold text-lead text-white leading-none">
                      {{ mainDist }}
                    </p>
                    <p
                      class="font-normal text-label text-primary truncate leading-tight"
                      :title="mainSub"
                    >
                      {{ mainSub }}
                    </p>
                  </div>
                  <div
                    class="flex flex-col flex-1 gap-1 bg-background p-3 border border-white/10 rounded-card min-w-0"
                  >
                    <p
                      class="font-semibold text-caption text-muted uppercase tracking-wide"
                    >
                      Cooldown
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

                <!-- coaching-section 9:558 -->
                <div
                  class="flex flex-col gap-1.5 pt-3 border-white/10 border-t"
                >
                  <p
                    class="font-bold text-label text-muted uppercase tracking-widest"
                  >
                    Why this workout
                  </p>
                  <p class="font-normal text-body text-muted leading-[1.4]">
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
              <div class="flex flex-col gap-3">
                <p
                  class="font-bold text-label text-muted uppercase leading-none tracking-widest"
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
              <WorkoutFeedbackForm
                v-model:rpe="rpe"
                v-model:status="status"
                v-model:note="note"
                :feedback-saved="feedbackSaved"
                :submitting="submitting"
                :header-date-short="headerDateShort"
                saved-message="✓ Session logged — coach will adapt next workout. View only."
                @submit="submitFeedback"
              />
            </div>

            <!-- right-col 9:601 — w-[340px] gap-5 -->
            <div class="flex flex-col gap-5 w-full lg:w-[340px] shrink-0">
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
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import api from "@/services/api.js";
import { useToast } from "@/composables/useToast.js";
import Skeleton from "@/components/ui/Skeleton.vue";
import ActivityCard from "@/components/ui/ActivityCard.vue";
import InsightCard from "@/components/ui/InsightCard.vue";
import GoalCard from "@/components/progress/GoalCard.vue";
import WorkoutFeedbackForm from "@/components/today/WorkoutFeedbackForm.vue";
import WeeklyProgression from "@/components/today/WeeklyProgression.vue";
import WeekSchedule from "@/components/today/WeekSchedule.vue";
import { formatPace } from "@/utils/format.js";
import { localDateKey as localKey, toLocalDateKey as toLocalStr } from "@/utils/dates.js";
import { WORKOUT_TYPE_NAMES, INTENSITY_LABELS } from "@/utils/labels.js";

const { t } = useI18n();
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
// local keys come from @/utils/dates.js (never UTC toISOString)
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
const isRest = computed(() => {
  const t = data.value?.recommendation?.type || data.value?.workout?.type || "";
  return t === "rest" || data.value?.isRest;
});
const workoutTypeLabel = computed(() => {
  const t =
    data.value?.recommendation?.type || data.value?.workout?.type || "workout";
  if (t === "rest") return "REST";
  return WORKOUT_TYPE_NAMES[t] || t.toUpperCase();
});
const intensityLabel = computed(() => {
  const t = data.value?.recommendation?.type || data.value?.workout?.type || "";
  return INTENSITY_LABELS[t] || data.value?.recommendation?.intensity || "—";
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
const insightCards = computed(() => {
  const ts = trainingState.value;
  const vs = volumeSeries.value || [];
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
  const paceStr = paceSec ? formatPace(paceSec) : "—";
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

async function checkCompletedAndNext() {
  const today = localKey();
  let isCompleted = false;
  // single activities fetch shared by both checks (was 2 sequential calls)
  let activityItems = null;
  async function getActivityItems() {
    if (!activityItems) {
      try {
        const { data } = await api.get("/activities", {
          params: { perPage: 10 },
        });
        activityItems = data.items || data || [];
      } catch {
        activityItems = [];
      }
    }
    return activityItems;
  }
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
    const items = await getActivityItems();
    const hit = items.find(
      (a) => toLocalStr(a.date || a.start_date) === today,
    );
    if (hit) {
      isCompleted = true;
      todayActivity.value = hit;
    }
  }
  if (!isCompleted) {
    try {
      const v = localStorage.getItem(`feedback:${today}`);
      const st = localStorage.getItem(`feedback:${today}:status`);
      if (v && (!st || st === "completed")) isCompleted = true;
    } catch {}
  }
  if (isCompleted && !todayActivity.value) {
    const items = await getActivityItems();
    todayActivity.value =
      items.find(
        (a) => toLocalStr(a.date || a.start_date) === today,
      ) || null;
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
    showToast(t("today.rpeRequired"), { type: "warning" });
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
    showToast(t("today.feedbackSaved"), { type: "success" });
    if (status.value === "completed") {
      todayCompleted.value = true;
      await checkCompletedAndNext();
    }
  } catch (e) {
    showToast(e.response?.data?.error || t("today.saveFailed"), { type: "error" });
  } finally {
    submitting.value = false;
  }
}
onMounted(async () => {
  // one parallel batch — was 4 sequential serverless round trips
  const [fbRes, todayRes, weekRes, progRes] = await Promise.allSettled([
    api.get("/plan/feedback"),
    api.get("/plan/today"),
    api.get("/plan/week"),
    api.get("/progress"),
  ]);
  try {
    const fb = fbRes.status === "fulfilled" ? fbRes.value.data : null;
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
    if (todayRes.status === "fulfilled") data.value = todayRes.value.data;
  } catch {}
  try {
    if (weekRes.status === "fulfilled") {
      const w = weekRes.value.data;
      week.value = w.week || [];
      weekMeta.value = w.weekMeta || null;
      goal.value = w.goal || null;
    }
  } catch {}
  try {
    if (progRes.status === "fulfilled") {
      const p = progRes.value.data;
      volumeSeries.value = p.volumeSeries || [];
      trainingState.value = p.trainingState || null;
      if (!goal.value && p.goalProgress) goal.value = goal.value; // keep week goal
    }
  } catch {}
  await checkCompletedAndNext();
  loading.value = false;
});
</script>
