// Week, next workout and week metadata from one athlete read. Deterministic; the
// safety > goal > consistency > volume > intensity > specificity > performance order is load-bearing.
import mongoose from "mongoose";
import { Activity } from "@/modules/activities/infrastructure/persistence/Activity.ts";
import { ActivityKind } from "@/modules/activities/domain/value-object/ActivityKind.ts";
import { kindOfActivity } from "@/modules/activities/domain/value-object/SportType.ts";
import { Athlete } from "@/modules/athlete/infrastructure/persistence/Athlete.ts";
import type {
  AthleteDoc,
  AthleteSession,
} from "@/modules/athlete/application/session.service.ts";
import { WorkoutFeedback } from "@/modules/training/infrastructure/persistence/WorkoutFeedback.ts";
import { serviceUnavailable } from "@/modules/shared/infrastructure/errors/AppError.ts";
import {
  calcTrainingState,
  type ActivityRecord,
  type TrainingState,
} from "@/modules/training/domain/training-state.ts";
import {
  WORKOUT_TEMPLATES,
  structureFor,
} from "@/modules/training/domain/templates.ts";
import {
  targetPace,
  targetHr,
  type ZonesInput,
} from "@/modules/training/domain/targets.ts";
import {
  downgradeOne,
  adaptiveCombined,
  adaptiveFromFeedback,
  localDateStr,
  fmtShortDate,
  type Feedback,
} from "@/modules/training/domain/adaptive.ts";
import {
  buildProgrammeWeek,
  workoutForRole,
  type SessionRole,
} from "@/modules/training/domain/programme.ts";
import { getWeekMeta } from "@/modules/training/domain/weekMeta.ts";
import {
  archetypeFor,
  dayRoleKey,
} from "@/modules/ai/domain/plan-archetypes.ts";
import {
  addDaysToKey,
  dateKeyInZone,
  daysBetweenKeys,
  weekdayOfKey,
} from "@/modules/shared/infrastructure/time/timeZone.ts";

export { getWeekMeta } from "@/modules/training/domain/weekMeta.ts";

/** The goal fields the plan reads (Mongo `Athlete.goal`). */
export interface Goal {
  goal_type?: string | null;
  goal_date?: string | number | Date | null;
  days_per_week?: number | null;
  preferred_days?: string[] | null;
}

export interface WeekWorkout {
  type: string;
  label: string;
  distance_km: number | null;
  status: string;
  originalType?: string;
  reason?: string;
}

export interface WeekDay {
  day: string;
  date: string;
  workout: WeekWorkout;
  isToday: boolean;
  role: SessionRole;
  /** Catalogue key suffix + params for the localized role label. The client
   *  resolves `ui.<key>`; the English sentence stays in the prompt. */
  programmeRole?: string | null;
  programmeRoleParams?: { phase?: string; target?: string } | null;
  /** The run the athlete actually did on this date, when one exists. */
  actual?: { distance_km: number | null; workout_type: string | null } | null;
}

export interface WeekProgrammeSummary {
  phase: string | null;
  weeks_out: number | null;
  cutback: boolean;
  taper: boolean;
  long_run_km: number | null;
  long_run_target_km: number | null;
  notes: string[];
}

export type WeekPlanDays = WeekDay[] & { programme: WeekProgrammeSummary };

/** Throws 503 when Mongo is unreachable — every plan read needs it. */
function requireDB() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable("Database not connected — check MONGODB_URI");
  }
}

async function getRecentFeedbacks(
  athleteId: string | null | undefined,
  days = 7,
): Promise<Feedback[]> {
  if (!athleteId) return [];
  try {
    const since = new Date(Date.now() - days * 86400000);
    return await WorkoutFeedback.find({
      athlete: athleteId,
      date: { $gte: since },
    })
      .sort({ date: -1 })
      .lean<Feedback[]>();
  } catch {
    return [];
  }
  // ponytail: implicit skips (preferred slot, no activity/feedback after 24h) are not inferred here — explicit Feedback wins (Q1C/Q6A).
}

export interface TrainingData {
  athlete: AthleteDoc | null;
  athleteId: string;
  goal: Goal | null;
  activities: ActivityRecord[];
  feedbacks: Feedback[];
  zones: ZonesInput;
}

/** Inputs loaded once. Null without athlete identity (the caller answers 401);
 *  `includeActivities: false` skips the full activity scan for a goal-only read. */
export async function loadTrainingData(
  session: AthleteSession,
  {
    includeActivities = true,
    includeFeedbacks = false,
    feedbackDays = 7,
    includeZones = false,
  }: {
    includeActivities?: boolean;
    includeFeedbacks?: boolean;
    feedbackDays?: number;
    includeZones?: boolean;
  } = {},
): Promise<TrainingData | null> {
  const athleteId = session?.athleteId;
  if (!athleteId) return null;
  requireDB();
  // Runs and cross-training together: the engine splits them (runs for volume and
  // pace, cross for load and interference), so the query stays simple.
  const activities: ActivityRecord[] = includeActivities
    ? await Activity.find({ athlete: athleteId })
        .select("-raw")
        .lean<ActivityRecord[]>()
    : [];
  // The session already loaded this row with exactly this projection.
  const athlete =
    session.athlete ??
    (await Athlete.findById(athleteId)
      .select("-access_token -refresh_token")
      .lean());
  // 7d default keeps the engine unchanged; the AI layer widens it — a complaint
  // about last Tuesday's run still matters while planning the coming week.
  const feedbacks = includeFeedbacks
    ? await getRecentFeedbacks(athlete?._id, feedbackDays)
    : [];
  return {
    athlete,
    athleteId,
    goal: athlete?.goal || null,
    activities,
    feedbacks,
    zones: includeZones
      ? athlete?.hr_zones?.length
        ? athlete.hr_zones
        : athlete?.zones || null
      : null,
  };
}

function weeksOut(
  goalDate: string | number | Date | null | undefined,
  today: Date | number | string = new Date(),
  timeZone?: string,
) {
  if (!goalDate) return null;
  const d = new Date(goalDate);
  if (Number.isNaN(d.getTime())) return null;
  const days = daysBetweenKeys(
    dateKeyInZone(new Date(today), timeZone),
    dateKeyInZone(d, timeZone),
  );
  return Number.isFinite(days) ? Math.ceil(days / 7) : null;
}

export interface WeekPlan {
  week: WeekPlanDays;
  weekMeta: { currentWeek: number; totalWeeks: number };
  goal: Goal | null;
  programme: WeekProgrammeSummary;
  /** The following Mon–Sun, programme-only (no adaptive pass, no actuals).
   *  Null when there is nothing honest to preview. */
  nextWeek: NextWeekPreview | null;
  athleteId: string;
  /** The deterministic inputs the week came from — the AI layer reads these. */
  state: TrainingState;
  activities: ActivityRecord[];
  feedbacks: Feedback[];
}

export interface NextWeekPreview {
  week: WeekPlanDays;
  weekMeta: { currentWeek: number; totalWeeks: number };
  programme: WeekProgrammeSummary;
}

/** Midday of the same weekday next week. Built from date parts, not
 *  `+7 * 86400000`: across a DST change that lands on 23:00 the previous day and
 *  shifts the whole preview back by one. */
export function nextWeekAnchor(from: Date): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 7);
  return d;
}

/** Monday of the week containing `now` as the plan writes it — the AI cache's week
 *  segment, so it is computed from the clock alone and answers before `planWeek()`
 *  runs. `buildWeekPlan` aligns to the same Monday and a test pins the two together. */
export function currentWeekKey(now: Date = new Date(), timeZone?: string): string {
  const key = dateKeyInZone(now, timeZone);
  const dow = weekdayOfKey(key);
  return addDaysToKey(key, dow === 0 ? -6 : 1 - dow);
}

/** Next week as the programme plans it. Built with empty feedbacks and activities:
 *  the adaptive passes are keyed to the current 7-day Feel Window, so applying
 *  today's fatigue seven days out would downgrade a slot for a state the athlete
 *  may no longer be in. Null when the goal race falls before that week starts. */
export function buildPreviewWeek(
  trainingState: TrainingState,
  goal: Goal | null,
  today: Date,
  timeZone?: string,
): WeekPlanDays | null {
  const anchor = nextWeekAnchor(today);
  const anchorKey = dateKeyInZone(anchor, timeZone);
  const anchorMonday = addDaysToKey(
    anchorKey,
    -((weekdayOfKey(anchorKey) + 6) % 7),
  );
  const goalDate = goal?.goal_date ? new Date(goal.goal_date) : null;
  const goalKey =
    goalDate && !Number.isNaN(goalDate.getTime())
      ? dateKeyInZone(goalDate, timeZone)
      : null;
  if (goalKey && goalKey < anchorMonday) {
    return null;
  }
  const week = buildWeekPlan(trainingState, goal, anchor, [], [], timeZone);
  const archetype = archetypeFor(goal?.goal_type);
  const out = weeksOut(goal?.goal_date, anchor, timeZone);
  for (const day of week) {
    const role = dayRoleKey(archetype, out, day.workout.type);
    day.programmeRole = role?.key ?? null;
    day.programmeRoleParams = role?.params ?? null;
    // The anchor is the same weekday next week, so buildWeekPlan marks it today.
    day.isToday = false;
    day.workout.status = "planned";
    delete day.actual;
  }
  return week;
}

/** The week, its metadata and the programme it belongs to. Null when the session
 *  carries no athlete identity. */
export async function planWeek(
  session: AthleteSession,
  {
    today = new Date(),
    feedbackDays = 7,
    timeZone,
  }: { today?: Date; feedbackDays?: number; timeZone?: string } = {},
): Promise<WeekPlan | null> {
  const data = await loadTrainingData(session, {
    includeFeedbacks: true,
    feedbackDays,
  });
  if (!data) return null;
  const { activities, goal, feedbacks, athlete } = data;
  const state = calcTrainingState(activities);
  const week = buildWeekPlan(state, goal, today, feedbacks, activities, timeZone);
  // programmeRole is deterministic — it belongs with the plan, not the AI
  // response, so the label renders even when AI is disabled or degraded.
  const archetype = archetypeFor(goal?.goal_type);
  const out = weeksOut(goal?.goal_date, today, timeZone);
  for (const day of week) {
    const role = dayRoleKey(archetype, out, day.workout.type);
    day.programmeRole = role?.key ?? null;
    day.programmeRoleParams = role?.params ?? null;
  }
  // Next week is derived, not stored, and hidden without a goal or history — that
  // would be a programme invented from nothing.
  const previewWeek =
    goal || activities.length
      ? buildPreviewWeek(state, goal, today, timeZone)
      : null;
  const nextWeek: NextWeekPreview | null = previewWeek
    ? {
        week: previewWeek,
        weekMeta: getWeekMeta(
          activities,
          goal,
          athlete,
          nextWeekAnchor(today),
          timeZone,
        ),
        programme: previewWeek.programme,
      }
    : null;
  return {
    week,
    goal,
    weekMeta: getWeekMeta(activities, goal, athlete, today, timeZone),
    programme: week.programme,
    nextWeek,
    athleteId: data.athleteId,
    state,
    activities,
    feedbacks,
  };
}

/** Today's next workout, derived from the same adapted week as `planWeek` so
 *  `originalType` is threaded in one place. Null without athlete identity. */
export async function planToday(
  session: AthleteSession,
  { today = new Date(), timeZone }: { today?: Date; timeZone?: string } = {},
) {
  const data = await loadTrainingData(session, {
    includeFeedbacks: true,
    includeZones: true,
  });
  if (!data) return null;
  const { activities, goal, zones, feedbacks } = data;
  const state = calcTrainingState(activities);
  const week = buildWeekPlan(state, goal, today, feedbacks, activities, timeZone);
  const todayEntry = week.find((w) => w.isToday);
  if (!todayEntry || todayEntry.workout.type === "rest") {
    return {
      isRest: true,
      date: todayEntry?.date,
      workout: todayEntry?.workout || { type: "rest", label: "REST" },
      training_state: {
        weekly_distance_km: state.weekly.distance7,
        runs_last_7_days: state.weekly.runs7,
      },
    };
  }
  // originalType, not the adapted type: the week already downgraded this slot
  // and adapting twice would drop two steps for one signal.
  const baseType = todayEntry.workout.originalType || todayEntry.workout.type;
  // Today's own run/feedback already happened — the recommendation must match
  // the week slot instead of adapting it again from today's data.
  const todayStr = localDateStr(today, timeZone);
  const priorFeedbacks = feedbacks.filter(
    (f) => fmtShortDate(f.date, timeZone) !== todayStr,
  );
  const priorActivities = activities.filter(
    (a) => localDateStr(a.date, timeZone) !== todayStr,
  );
  const detail = buildRecommendationForType(
    state,
    goal,
    zones,
    baseType,
    priorFeedbacks,
    priorActivities,
    timeZone,
  );
  return { ...detail, date: todayEntry.date, workout: todayEntry.workout };
}

const GOAL_LABELS: Record<string, string> = {
  half_marathon: "Half Marathon",
  marathon: "Marathon",
  distance_completion: "Distance Completion",
  maintain: "Maintain Fitness",
  general_fitness: "General Fitness",
  "5K": "5K",
  "10K": "10K",
};

export function buildRecommendationForType(
  trainingState: TrainingState,
  goal: Goal | null,
  zones: ZonesInput,
  type: string,
  feedbacks: Feedback[] = [],
  activities: ActivityRecord[] = [],
  timeZone?: string,
) {
  // adaptive: instant, next workout only — RPE+status (7d) + last-activity distance deviation vs plan
  const adapted = adaptiveCombined(feedbacks, activities, type, timeZone);
  const effectiveType = adapted ? adapted.type : type;
  // rest is a synthetic state — no template
  if (effectiveType === "rest") {
    return {
      isRest: true,
      training_state: {
        weekly_distance_km: trainingState.weekly.distance7,
        runs_last_7_days: trainingState.weekly.runs7,
        long_run_km: trainingState.weekly.longRun7,
        hard_sessions_last_7_days: trainingState.weekly.hardSessions7,
        trend: trainingState.trend,
        fatigue_signals: trainingState.fatigueSignals,
      },
      recommendation: {
        type: "rest",
        label: "REST",
        distance_km: null,
        duration_min: null,
        intensity: "rest",
        purpose: "Recovery is training — no run scheduled",
        warmup: null,
        main_set: null,
        cooldown: null,
        target_pace: null,
        target_hr: null,
        target_hr_source: zones ? "device" : "estimate",
        alternative: null,
      },
      confidence: 0.82,
      reasons: [
        `Scheduled ${type} per your weekly plan${goal?.goal_type ? ` for ${GOAL_LABELS[goal.goal_type] || goal.goal_type}` : ""}`,
        adapted!.reason,
        "Adapted to rest based on recent feedback/activity",
      ],
    };
  }
  // No template fallback: an object spread is always truthy, so `|| { ...easy }`
  // never ran and an unknown type silently yielded an empty template.
  const tpl = { ...WORKOUT_TEMPLATES[effectiveType] };
  const recentLong =
    trainingState.weekly.longRun28 || trainingState.weekly.longRun7 || 6;
  if (effectiveType === "long" && tpl.distance_km > recentLong + 2)
    tpl.distance_km = +(recentLong + 1.5).toFixed(1);
  const struct = structureFor(effectiveType);
  const reasons = [
    `Scheduled ${type} per your weekly plan${goal?.goal_type ? ` for ${GOAL_LABELS[goal.goal_type] || goal.goal_type}` : ""}`,
  ];
  if (adapted) {
    reasons.push(adapted.reason);
    if (effectiveType !== type)
      reasons.push(
        `Adapted: ${type} → ${effectiveType} based on recent feedback/activity`,
      );
  }
  return {
    training_state: {
      weekly_distance_km: trainingState.weekly.distance7,
      runs_last_7_days: trainingState.weekly.runs7,
      long_run_km: trainingState.weekly.longRun7,
      hard_sessions_last_7_days: trainingState.weekly.hardSessions7,
      trend: trainingState.trend,
      fatigue_signals: trainingState.fatigueSignals,
    },
    recommendation: {
      type: tpl.type,
      distance_km: tpl.distance_km,
      duration_min: tpl.duration_min,
      intensity: tpl.intensity,
      purpose: tpl.purpose,
      warmup: struct.warmup,
      main_set: struct.main,
      cooldown: struct.cooldown,
      target_pace: targetPace(trainingState, effectiveType),
      target_hr: targetHr(effectiveType, zones),
      target_hr_source: zones ? "device" : "estimate",
      alternative:
        "If legs feel unusually heavy: reduce to 30–40 min very easy or take a recovery day.",
    },
    confidence: trainingState.hasFatigueSignal ? 0.72 : 0.82,
    reasons,
    adapted: adapted
      ? { from: type, to: effectiveType, reason: adapted.reason }
      : null,
  };
}

export function buildWeekPlan(
  trainingState: TrainingState,
  goal: Goal | null,
  startDate: Date = new Date(),
  feedbacks: Feedback[] = [],
  activities: ActivityRecord[] = [],
  timeZone?: string,
): WeekPlanDays {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // Week aligned Mon–Sun containing startDate (Figma 9:533: MON…SUN, today highlighted),
  // in the athlete's zone when the request carries one.
  const todayStr = localDateStr(startDate, timeZone);
  const dow = weekdayOfKey(todayStr);
  const mondayKey = addDaysToKey(todayStr, dow === 0 ? -6 : 1 - dow);
  // Programme-driven assignment: the distance programme decides how many easy /
  // quality / long days there are and this week's long run, capped by what the
  // athlete has actually run (plan/programme.ts). The adaptive passes still get
  // the final word on their real state.
  const programme = buildProgrammeWeek(trainingState, goal, mondayKey, timeZone);
  const week: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysToKey(mondayKey, i);
    const isToday = dateStr === todayStr;
    const dayName = days[i];
    const role = programme.roles[i];
    const built = role === "rest" ? null : workoutForRole(role, programme, i);
    // Distance stays numeric; the renderer owns the unit.
    const workout: WeekWorkout = built
      ? {
          type: built.type,
          label: built.label,
          distance_km: built.distance_km,
          status: isToday ? "today" : "planned",
        }
      : { type: "rest", label: "REST", distance_km: null, status: "planned" };
    week.push({ day: dayName, date: dateStr, workout, isToday, role });
  }
  // Adaptive: next workout only (Q8A), swapping the isToday slot. Today's own
  // feedback/activity is excluded, so a sync or reload cannot rewrite the session
  // that already happened (that is what made the weekly grid flip).
  const todayEntry = week.find((w) => w.isToday);
  if (todayEntry && todayEntry.workout.type !== "rest") {
    const priorFeedbacks = feedbacks.filter(
      (f) => fmtShortDate(f.date, timeZone) !== todayStr,
    );
    const priorActivities = activities.filter(
      (a) => localDateStr(a.date, timeZone) !== todayStr,
    );
    const adapted = adaptiveCombined(
      priorFeedbacks,
      priorActivities,
      todayEntry.workout.type,
      timeZone,
    );
    if (adapted) {
      if (adapted.type === "rest") {
        todayEntry.workout = {
          type: "rest",
          label: "REST",
          distance_km: null,
          status: "adapted",
          originalType: todayEntry.workout.type,
          reason: adapted.reason,
        };
      } else if (adapted.type !== todayEntry.workout.type) {
        const tpl = { ...WORKOUT_TEMPLATES[adapted.type] };
        todayEntry.workout = {
          type: adapted.type,
          label: adapted.type.toUpperCase(),
          distance_km: tpl.distance_km,
          status: "adapted",
          originalType: todayEntry.workout.type,
          reason: adapted.reason,
        };
      }
    }
  }
  // After a skipped preferred slot, ease the next hard sessions but keep them on
  // their preferred days (a skipped recovery today makes tomorrow's tempo recovery).
  {
    // Anchor on startDate's day, not the wall clock: callers passing a fixed
    // startDate otherwise still got "recent" measured against today.
    const cutoffKey = addDaysToKey(todayStr, -7);
    const recentSkipped = [...(feedbacks || [])]
      .map((feedback) => ({
        feedback,
        key: fmtShortDate(feedback.date, timeZone),
      }))
      .filter(
        ({ feedback, key }) =>
          feedback.status === "skipped" && key >= cutoffKey && key <= todayStr,
      )
      .sort((a, b) => b.key.localeCompare(a.key))[0]?.feedback;
    if (recentSkipped) {
      const skippedDateStr = fmtShortDate(recentSkipped.date, timeZone);
      let futurePos = 0;
      const isPlainSkip = recentSkipped.rpe == null;
      for (const entry of week) {
        if (entry.workout.type === "rest") continue;
        if (entry.isToday) continue;
        if (entry.date <= skippedDateStr) continue;
        futurePos += 1;
        if (isPlainSkip) {
          // plain skip: every remaining preferred slot this week becomes recovery (Sunday too)
          if (entry.workout.type !== "recovery") {
            const tpl = { ...WORKOUT_TEMPLATES.recovery };
            entry.workout = {
              type: "recovery",
              label: "RECOVERY",
              distance_km: tpl.distance_km,
              status: "adapted",
              originalType: entry.workout.type,
              reason: `Recovery after skipped workout on ${skippedDateStr}`,
            };
          }
        } else if (futurePos === 1) {
          // high-RPE skip: immediate next slot respects RPE
          const adapted = adaptiveFromFeedback(
            [recentSkipped],
            entry.workout.type,
            timeZone,
          );
          let target = adapted?.type || null;
          if (!target) target = "recovery";
          else if (target === "easy") target = "recovery";
          if (target && target !== entry.workout.type) {
            const reason =
              adapted?.reason ||
              `Recovery after skipped workout on ${skippedDateStr}`;
            if (target === "rest")
              entry.workout = {
                type: "rest",
                label: "REST",
                distance_km: null,
                status: "adapted",
                originalType: entry.workout.type,
                reason,
              };
            else {
              const tpl = { ...WORKOUT_TEMPLATES[target] };
              entry.workout = {
                type: target,
                label: target.toUpperCase(),
                distance_km: tpl.distance_km,
                status: "adapted",
                originalType: entry.workout.type,
                reason,
              };
            }
          }
        } else if (futurePos === 2) {
          // second slot after high-RPE skip: soften one step
          if (
            ["tempo", "threshold", "interval", "steady", "long"].includes(
              entry.workout.type,
            )
          ) {
            const down = downgradeOne(entry.workout.type);
            if (down !== entry.workout.type) {
              const tpl = { ...WORKOUT_TEMPLATES[down] };
              entry.workout = {
                type: down,
                label: down.toUpperCase(),
                distance_km: tpl.distance_km,
                status: "adapted",
                originalType: entry.workout.type,
                reason: `Eased after skipped workout on ${skippedDateStr}`,
              };
            }
          }
        } else break;
      }
    }
  }
  // Mark the skipped day itself, or the schedule still shows a planned workout.
  for (const entry of week) {
    const hit = feedbacks.find(
      (f) =>
        f.status === "skipped" &&
        fmtShortDate(f.date, timeZone) === entry.date,
    );
    if (hit && entry.workout.type !== "rest") {
      // Keep the workout, flag it skipped; never override an adapted today slot.
      if (!entry.isToday || entry.workout.status === "planned") {
        entry.workout = {
          ...entry.workout,
          status: "skipped",
          originalType: entry.workout.originalType || entry.workout.type,
          reason: `Skipped on ${entry.date}`,
        };
      }
    }
  }
  // What was actually run, so the schedule and Today's ActivityCard agree on a day
  // already done (planned 8 km vs ran 4 km). Runs only: cross-training has its own
  // card and never fills a run slot.
  const runsByDate = new Map<string, ActivityRecord>();
  for (const activity of activities) {
    if (
      kindOfActivity(activity) !== ActivityKind.Run ||
      activity.distance_km == null
    )
      continue;
    const dateKey = localDateStr(activity.date, timeZone);
    const previous = runsByDate.get(dateKey);
    if (
      !previous ||
      (activity.distance_km ?? 0) > (previous.distance_km ?? 0)
    ) {
      runsByDate.set(dateKey, activity);
    }
  }
  for (const entry of week) {
    const actual = runsByDate.get(entry.date);
    if (!actual) continue;
    entry.actual = {
      distance_km: actual.distance_km ?? null,
      workout_type: actual.workout_type ?? null,
    };
  }
  return Object.assign(week, {
    programme: {
      phase: programme.phase,
      weeks_out: programme.weeksOut,
      cutback: programme.cutback,
      taper: programme.taper,
      long_run_km: programme.longRunKm,
      long_run_target_km: programme.longRunTargetKm,
      notes: programme.notes,
    },
  });
}
