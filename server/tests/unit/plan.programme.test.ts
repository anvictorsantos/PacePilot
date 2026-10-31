import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildWeekPlan } from "@/modules/training/application/plan.service.ts";
import {
  buildProgrammeWeek,
  fitnessLongRunKm,
  parseKm,
  weeksUntilGoal,
} from "@/modules/training/domain/programme.ts";

type ProgrammeSummary = {
  phase: string | null;
  weeks_out: number | null;
  cutback: boolean;
  taper: boolean;
  long_run_km: number | null;
  long_run_target_km: number | null;
  notes: string[];
};
type PlannedWeek = ReturnType<typeof buildWeekPlan> & {
  programme: ProgrammeSummary;
};
type FeedbackRow = { date: string; status: string; rpe?: number | null };

// buildWeekPlan defaults its params to `[]`, which narrows `feedbacks`/`activities`
// to `never[]`, and its return type hides the attached `programme` summary.
const buildWeek = buildWeekPlan as unknown as (
  trainingState: unknown,
  goal: unknown,
  startDate: Date,
  feedbacks?: FeedbackRow[],
  activities?: unknown[],
) => PlannedWeek;

function monday() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Anchored on this week's Monday because that is what weeksUntilGoal counts from;
// Date.now() made every case land a week later.
function goalIn(weeks: number, over: Record<string, unknown> = {}) {
  const m = monday();
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() + weeks * 7);
  return {
    goal_type: "marathon",
    goal_date: m.toISOString(),
    days_per_week: 5,
    preferred_days: ["Monday", "Wednesday", "Friday", "Saturday", "Sunday"],
    ...over,
  };
}

const FIT = {
  weekly: {
    distance7: 38,
    distance28: 120,
    runs7: 5,
    longRun7: 18,
    longRun28: 20,
    hardSessions7: 1,
    hardSessions14: 2,
  },
  trend: "building",
  fatigueSignals: [],
  hasFatigueSignal: false,
};
const NEWBIE = {
  weekly: {
    distance7: 10,
    distance28: 20,
    runs7: 2,
    longRun7: 5,
    longRun28: 6,
    hardSessions7: 0,
    hardSessions14: 0,
  },
  trend: "stable",
  fatigueSignals: [],
  hasFatigueSignal: false,
};

describe("parseKm", () => {
  test("reads a single distance", () => {
    assert.equal(parseKm("10 km"), 10);
    assert.equal(parseKm("13.1 km"), 13.1);
    assert.equal(parseKm("21.1 km (half)"), 21.1);
  });

  test("averages a range so a 22-26 week does not prescribe the ceiling", () => {
    assert.equal(parseKm("22-26 km (14-16 miles)"), 24);
    assert.equal(parseKm("29-35 km (18-22 miles)"), 32);
  });

  test("converts time targets at a deliberately slow 6 min/km", () => {
    // 6 min/km on purpose: a time target must never become a longer distance
    // than the athlete trained for.
    assert.equal(parseKm("120 minutes"), 12);
    assert.equal(parseKm("90 minutes"), 9);
    assert.equal(parseKm("30 minutes easy"), 3);
  });

  test("returns null when there is no distance at all", () => {
    assert.equal(parseKm("short / cross-training"), null);
    assert.equal(parseKm(""), null);
  });
});

describe("weeksUntilGoal", () => {
  test("counts whole weeks from the start of this training week", () => {
    const w = weeksUntilGoal(goalIn(8), monday());
    assert.ok(w === 8 || w === 9, `unexpected week count ${w}`);
  });

  test("no goal date means null", () => {
    assert.equal(weeksUntilGoal({}, monday()), null);
    assert.equal(weeksUntilGoal(null, monday()), null);
  });
});

describe("fitnessLongRunKm", () => {
  test("takes the longest run the athlete has actually done", () => {
    assert.equal(
      fitnessLongRunKm({ weekly: { longRun7: 18, longRun28: 20 } }),
      20,
    );
    assert.equal(
      fitnessLongRunKm({ weekly: { longRun7: 18, longRun28: 0 } }),
      18,
    );
  });

  test("null when there is no run history", () => {
    assert.equal(
      fitnessLongRunKm({ weekly: { longRun7: 0, longRun28: 0 } }),
      null,
    );
    assert.equal(fitnessLongRunKm({}), null);
  });
});

describe("week shape follows the programme", () => {
  test("marathon gets three easy days, one quality and one long", () => {
    // Week 8, not 10 — week 10 is a cutback and swaps easy for recovery.
    const p = buildProgrammeWeek(FIT, goalIn(8));
    const counts = p.roles.reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }),
      {},
    );
    assert.equal(p.cutback, false);
    assert.equal(counts.long, 1);
    assert.equal(counts.quality, 1);
    assert.ok(
      counts.easy >= 2,
      `expected >=2 easy days, got ${JSON.stringify(counts)}`,
    );
    assert.ok(
      counts.rest >= 2,
      `expected >=2 rest days, got ${JSON.stringify(counts)}`,
    );
  });

  test("5K and half get two quality sessions, marathon gets one", () => {
    const five = buildProgrammeWeek(
      FIT,
      goalIn(6, {
        goal_type: "5K",
        days_per_week: 4,
        preferred_days: ["Tuesday", "Thursday", "Saturday", "Sunday"],
      }),
    );
    const half = buildProgrammeWeek(
      FIT,
      goalIn(10, { goal_type: "half_marathon" }),
    );
    const mar = buildProgrammeWeek(FIT, goalIn(10));
    assert.equal(five.roles.filter((r) => r === "quality").length, 2);
    assert.equal(half.roles.filter((r) => r === "quality").length, 2);
    assert.equal(mar.roles.filter((r) => r === "quality").length, 1);
  });

  test("a five-run week is actually five runs", () => {
    const half = buildProgrammeWeek(
      FIT,
      goalIn(10, { goal_type: "half_marathon", days_per_week: 5 }),
    );
    assert.equal(half.roles.filter((r) => r !== "rest").length, 5);
  });

  test("the two quality sessions are different stimuli", () => {
    const p = buildProgrammeWeek(
      FIT,
      goalIn(6, {
        goal_type: "5K",
        days_per_week: 4,
        preferred_days: ["Tuesday", "Thursday", "Saturday", "Sunday"],
      }),
    );
    const types = p.qualityByIndex.filter(Boolean);
    assert.equal(types.length, 2);
    assert.notEqual(
      types[0],
      types[1],
      "two identical hard days is poor programming",
    );
  });

  test("long run lands on a weekend day when one is available", () => {
    const p = buildProgrammeWeek(FIT, goalIn(10));
    const idx = p.roles.indexOf("long");
    assert.ok(idx === 5 || idx === 6, `long run on index ${idx}`);
  });

  test("a quality session is never adjacent to the long run", () => {
    for (const weeks of [4, 8, 10, 12, 15]) {
      const p = buildProgrammeWeek(FIT, goalIn(weeks));
      const longIdx = p.roles.indexOf("long");
      for (let i = 0; i < 7; i++) {
        if (p.roles[i] === "quality") {
          assert.notEqual(
            Math.abs(i - longIdx),
            1,
            `quality adjacent to long in week ${weeks}`,
          );
        }
      }
    }
  });

  test("days_per_week is honoured rather than ignored", () => {
    const three = buildProgrammeWeek(
      FIT,
      goalIn(10, {
        days_per_week: 3,
        preferred_days: ["Monday", "Wednesday", "Friday", "Saturday", "Sunday"],
      }),
    );
    assert.equal(three.roles.filter((r) => r !== "rest").length, 3);
  });
});

describe("long-run progression tracks the programme", () => {
  test("marathon long run rises through the build then tapers", () => {
    const at = (w: number) => {
      const km = buildProgrammeWeek(FIT, goalIn(w)).longRunKm;
      assert.ok(km != null);
      return km;
    };
    const build = at(14),
      mid = at(12),
      peak = at(8);
    assert.ok(build < mid, `expected build < mid (${build} vs ${mid})`);
    assert.ok(mid < peak, `expected mid < peak (${mid} vs ${peak})`);
    assert.ok(at(3) < peak, "taper must drop below peak");
    assert.ok(at(2) < at(3), "taper must keep dropping toward the race");
  });

  test("half marathon follows its own shape, including the 60-minute week", () => {
    const half = (w: number) => {
      const km = buildProgrammeWeek(
        FIT,
        goalIn(w, { goal_type: "half_marathon" }),
      ).longRunKm;
      assert.ok(km != null);
      return km;
    };
    assert.equal(half(13), 6.4);
    assert.equal(half(11), 10);
    assert.equal(half(9), 13);
    assert.equal(half(7), 16);
    assert.equal(half(5), 13.1);
    assert.equal(half(4), 20);
    assert.equal(half(3), 6, "the time-based week converts conservatively");
  });

  test("the programme target is reported separately from the clamped value", () => {
    const p = buildProgrammeWeek(FIT, goalIn(5));
    assert.equal(
      p.longRunTargetKm,
      32,
      "peak long run from the source programme",
    );
    assert.equal(p.longRunKm, 22, "clamped to the athlete fitness ceiling");
  });
});

describe("fitness ceiling — the programme is a target, not a command", () => {
  test("a beginner is never told to run a marathon long run", () => {
    const p = buildProgrammeWeek(NEWBIE, goalIn(5));
    const km = p.longRunKm;
    assert.ok(km != null);
    assert.ok(km <= 8, `newbie told to run ${km} km`);
  });

  test("the clamp is explained to the athlete, not applied silently", () => {
    const p = buildProgrammeWeek(NEWBIE, goalIn(5));
    assert.ok(
      p.notes.some((n) => /capped/i.test(n)),
      `expected a cap note, got ${JSON.stringify(p.notes)}`,
    );
  });

  test("no cap note when the athlete can already do the target", () => {
    const strong = {
      weekly: {
        distance7: 60,
        distance28: 260,
        runs7: 6,
        longRun7: 32,
        longRun28: 34,
        hardSessions7: 1,
        hardSessions14: 2,
      },
      trend: "building",
      fatigueSignals: [],
      hasFatigueSignal: false,
    };
    const p = buildProgrammeWeek(strong, goalIn(5));
    assert.equal(p.longRunKm, p.longRunTargetKm);
    assert.equal(
      p.notes.some((n) => /capped/i.test(n)),
      false,
    );
  });

  test("an athlete with no history gets the template long run, still not inflated", () => {
    const blank = {
      weekly: { distance7: 0, runs7: 0, longRun7: 0, longRun28: 0 },
      trend: "stable",
      fatigueSignals: [],
    };
    const p = buildProgrammeWeek(blank, goalIn(10));
    const km = p.longRunKm;
    assert.ok(km != null);
    assert.ok(km > 0 && km <= 12);
  });
});

describe("cutback and taper", () => {
  test("marathon cutback weeks are the 3:1 cycle weeks", () => {
    for (const week of [16, 13, 10, 6]) {
      assert.equal(
        buildProgrammeWeek(FIT, goalIn(week)).cutback,
        true,
        `week ${week} should be a cutback`,
      );
    }
    assert.equal(buildProgrammeWeek(FIT, goalIn(12)).cutback, false);
  });

  test("a cutback week swaps easy days for recovery and explains itself", () => {
    const p = buildProgrammeWeek(FIT, goalIn(13));
    assert.ok(p.roles.includes("recovery"));
    assert.ok(p.notes.some((n) => /cutback/i.test(n)));
  });

  test("taper is derived from the phase, so the flag and the label agree", () => {
    for (const week of [1, 2, 3, 4]) {
      const p = buildProgrammeWeek(FIT, goalIn(week));
      assert.equal(p.taper, true, `week ${week} should taper`);
      assert.equal(p.phase, "taper", `week ${week} phase should say taper`);
    }
  });

  test("taper removes hard sessions entirely", () => {
    for (const week of [1, 2]) {
      assert.equal(
        buildProgrammeWeek(FIT, goalIn(week)).roles.includes("quality"),
        false,
      );
    }
  });

  test("the taper is not double-counted on top of the taper phase target", () => {
    // Week 3 is already 19-23 km; the safety net on top collapsed the taper.
    const p = buildProgrammeWeek(FIT, goalIn(3));
    const km = p.longRunKm;
    assert.ok(km != null);
    assert.ok(km >= 19, `taper week 3 collapsed to ${km} km`);
  });
});

describe("phase reporting", () => {
  test("every marathon week resolves to a phase", () => {
    for (let w = 1; w <= 18; w++) {
      assert.ok(
        buildProgrammeWeek(FIT, goalIn(w)).phase,
        `no phase at week ${w}`,
      );
    }
  });

  test("an athlete further out than the programme lands in its first phase", () => {
    assert.equal(buildProgrammeWeek(FIT, goalIn(30)).phase, "base");
  });

  test("no goal means no phase claim beyond consolidation", () => {
    assert.equal(buildProgrammeWeek(FIT, null).phase, "consolidation");
  });
});

describe("buildWeekPlan integrates the programme", () => {
  test("still returns seven Monday-to-Sunday entries", () => {
    assert.equal(buildWeek(FIT, goalIn(10), monday(), [], []).length, 7);
  });

  test("exposes the programme on the result", () => {
    const week = buildWeek(FIT, goalIn(13), monday(), [], []);
    assert.equal(week.programme.cutback, true);
    assert.ok(week.programme.notes.length > 0);
    assert.ok(typeof week.programme.long_run_km === "number");
  });

  test("every scheduled day has a real distance and a rest day has none", () => {
    const week = buildWeek(FIT, goalIn(10), monday(), [], []);
    for (const day of week) {
      if (day.workout.type === "rest")
        assert.equal(day.workout.distance_km, null);
      else {
        // A number, not a display string: the unit is the renderer's business and
        // the AI must not have to regex it back out.
        const km = day.workout.distance_km;
        assert.equal(typeof km, "number");
        assert.ok(km != null && km > 0);
      }
    }
  });

  test("the long run is the longest distance of the week", () => {
    for (const weeks of [5, 8, 12, 15]) {
      const week = buildWeek(FIT, goalIn(weeks), monday(), [], []);
      const dists = week
        .filter((d) => d.workout.type !== "rest")
        .map((d) => d.workout.distance_km)
        .filter((km): km is number => km != null);
      const longDay = week.find((d) => d.role === "long");
      assert.ok(longDay, `no long run at week ${weeks}`);
      assert.equal(longDay.workout.distance_km, Math.max(...dists));
    }
  });

  test("is deterministic — the same week twice gives the same plan", () => {
    const a = buildWeek(FIT, goalIn(11), monday(), [], []);
    const b = buildWeek(FIT, goalIn(11), monday(), [], []);
    assert.deepEqual(a, b);
  });

  // Both cases below depend on the weekday and clock; anchor them to a fixed
  // Wednesday so the assertion is about behaviour, not the day CI runs.
  const FIXED_TODAY = new Date("2026-03-04T09:00:00");

  test("today's own feedback does not rewrite today's session", () => {
    const feedbacks = [
      { date: FIXED_TODAY.toISOString(), status: "skipped", rpe: 9 },
    ];
    const baseline = buildWeek(FIT, goalIn(10), FIXED_TODAY, [], []);
    const week = buildWeek(FIT, goalIn(10), FIXED_TODAY, feedbacks, []);
    const before = baseline.find((d) => d.isToday);
    const today = week.find((d) => d.isToday);
    assert.ok(today && before);
    // A run already logged is not a "next workout" signal: re-reading the plan
    // must not rewrite the session that already happened.
    assert.equal(today.workout.type, before.workout.type);
    assert.equal(today.workout.status, before.workout.status);
  });

  test("a high-RPE skip eases the next session, never today", () => {
    const feedbacks = [
      { date: "2026-03-03T09:00:00", status: "skipped", rpe: 9 },
    ];
    const week = buildWeek(FIT, goalIn(10), FIXED_TODAY, feedbacks, []);
    const later = week.filter((d) => !d.isToday);
    assert.ok(
      later.some(
        (d) => d.workout.status === "skipped" || d.workout.status === "adapted",
      ),
      `no later session adapted: ${JSON.stringify(later.map((d) => [d.day, d.workout.type, d.workout.status]))}`,
    );
  });

  test("a null goal still produces a usable week", () => {
    const week = buildWeek(FIT, null, monday(), [], []);
    assert.equal(week.length, 7);
    assert.ok(week.filter((d) => d.workout.type !== "rest").length >= 1);
  });
});
