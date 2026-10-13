# PacePilot — Adaptive Strava Running Coach

Evidence from Strava, decisions from the training engine, explanations from the LLM. The plan follows a goal but bends to recent feel and attendance.

## Language

### Training

**Goal**:
The target the plan is built toward (e.g. `half_marathon`, `5K`, `distance_completion`).
_Avoid_: target, objective, race

**TrainingState**:
Rolling view derived from Strava activities (weekly distance, runs, hard sessions, trend, fatigue signals) over 7/14/28/42–84d windows.
_Avoid_: fitness state, summary

**Workout**:
A single session prescription with `type` (recovery/easy/long/steady/tempo/threshold/interval), distance, intensity, and `purpose`.
_Avoid_: training, session, run

**Plan (Week)**:
The 7-day schedule generated from `TrainingState` + `Goal` + `preferred_days` and `goal_date` (taper/deload). Ephemeral; recomputed on read.
_Avoid_: schedule, program

**Next Workout (Today)**:
The one `Workout` for today derived from the Week's `isToday` slot and optionally adapted by recent Feedback or last-activity Deviation.
_Avoid_: daily plan, today's training

### Adaptive Loop

**Feedback**:
User-reported outcome for a date: `rpe 1–10`, `status` (completed | skipped | modified), optional `note`.
_Avoid_: feel, report, rating, RPE alone

**RPE**:
Perceived effort 1 (very easy) → 10 (maximal) for the Feedback date.
_Avoid_: feel score, exertion

**Skipped**:
Feedback with `status='skipped'` for a date that was a planned slot. Only dates whose weekday is in `preferred_days` count as a skippable slot; `rest` days cannot be skipped unless explicitly marked.
_Avoid_: missed, absent, no-show

**Implicit Skip**:
Inferred absence: a planned slot with no `Feedback` and no Strava `Activity` after 24h. Fallback when explicit Feedback is absent; explicit Feedback always wins.
_Avoid_: auto-skip, assumed skip

**Feel Window**:
The 7-day lookback of `Feedback.rpe` + `status` that the engine reads on each `GET /today` / `GET /week`. Decays after 7 days.
_Avoid_: history, rolling feel

**Downgrade**:
Deterministic adaptation of the next `Workout` type due to recent Feedback or Deviation: `RPE 8 → drop one intensity step (e.g. tempo→steady)`, `RPE 9 → recovery`, `RPE 10 → rest`; `Skipped (plain, no RPE) → recovery 4km` (was `easy 6km`), `Skipped + RPE≥9 → recovery`; plain skip now eases **all remaining preferred slots of the week** to `recovery` (so Thu + Sun both `4km` after a Wed skip), not just the next 1–2. `Deviation +25% over planned distance → downgrade one`, `+40% or +5km → recovery`, `−25% under → downgrade one`, `−40% → easy`. Applied to the next workout via `adaptiveCombined`; week reorder applies to future slots. Most conservative signal wins. `GET /today` passes `originalType` to `buildRecommendationForType` to avoid double downgrade.
_Avoid_: adjustment, deload (deload is the separate 7–14d taper concept)

**Deviation**:
Distance delta of the last Strava `Activity` (≤3 days old) versus `WORKOUT_TEMPLATES[workout_type].distance_km`. Read on each `GET /today`/`GET /week` alongside the Feel Window.
_Avoid_: overrun, underrun

**CoachInsight**:
The one-line human explanation attached to an adapted Next Workout (e.g. "Recovery — RPE 9 yesterday + skipped long run"). Engine decides, LLM explains; notes are display-only.
_Avoid_: reason, message, advice (never medical diagnosis)

**Note**:
Free-text attached to Feedback, never read by the deterministic engine; available only to the LLM explain layer.
_Avoid_: comment, description

### Goal Progress

**Goal Progress**:
Consistency in the last 28 days — `completed runs / planned runs` where `planned = preferred_days.length × 4`. Computed server-side by `GET /progress` as `goalProgress: { pct, planned, completed } | null`. Returns `null` (rendered as `—`) when `<14d` of history exists or `planned = 0`; never faked as `62` or `totalActivities/24`. Label shows `completed/planned runs in last 28 days`; trend text is a secondary caption.
_Avoid_: pct (as a bare number), completion %, timeline %

### Week & Program

**WeekMeta**:
`{ currentWeek, totalWeeks }` returned by `GET /plan/week` via `getWeekMeta()`. `currentWeek` is weeks since `Program Start` (1-indexed, capped at `totalWeeks`); `totalWeeks` is `ceil((goal_date − Program Start) / 7)` else `12` when `goal_date` or `Program Start` is missing.
_Avoid_: week number alone, week count as days

**Program Start (goalSetAt)**:
Anchor for `WeekMeta.currentWeek`. Priority: `Athlete.goalSetAt` (set on `PUT /goals`) → `Athlete.createdAt` (when a goal exists) → earliest `Activity.date` → fallback `12`-week block. Prevents "Week 1 of 12" from drifting when the goal is edited.
_Avoid_: created date, first activity date alone

**Week Alignment**:
Week is `Mon–Sun` containing `today`; each entry's `isToday` is matched by `localDateStr(today) === localDateStr(entry)` (not `toISOString` UTC which shifts at midnight in `+/-` TZ). Server `plan.service.js` `localDateStr()` + client `localKey()`/`toLocalStr()` guarantee the badge lands on the local day (e.g. Thu 27 not Wed 26 at 00:30 Lisbon). `GET /today` detail uses `originalType` to avoid double downgrade vs. week.
_Avoid_: startDate + 0 offset, index-based today, `toISOString().slice(0,10)` for `isToday`

### Performance & Insights

**Performance Insights (InsightCard)**:
Four cards shown on `Today` (both planned and completed states): `Weekly Distance` (last non-zero volume bar vs. prior week, with `+X%` delta), `Hard Sessions` (`weekly.hardSessions7 / wk`), `Avg Pace` (`secToPace(avgPace7||avgPace28)`), `Consistency` (`runs28 / planned28` where `planned28 = preferred_days.length × 4`). Styled per Figma `9:564` (`bg-card` / `bg-primary/[0.13]` when highlighted), demo falls back to `34.2 km / 2 / 5:28 / 92%` when `distance7===0` but volumeSeries has data.
_Avoid_: generic stats, metric tile

**WeeklyProgression**:
Bar series from `GET /progress.volumeSeries` with `activeIndex = last` highlighted in `primary`. Peak label is `max(distance).toFixed(1) km Peak`. Rendered in `GoalCard` side-column on desktop.
_Avoid_: chart, graph

**ActivityCard (Today density)**:
Figma `9:536` density: type badge (`TEMPO RUN` etc.), intensity dot + label, `48px` distance headline, 3 metric cells (Distance / Avg Pace / Time), `Run details` coaching line with trophies. `workout_type → intensityLabel/dotClass` mapping shared with `TodayWorkoutView`.
_Avoid_: activity tile, run card

### Feedback Lifecycle

**Locked (View-Only) Feedback**:
Once `feedbackSaved` is true for `todayKey (YYYY-MM-DD)` (from `GET /plan/feedback` hit or `localStorage feedback:${date}`), the `Log completed workout` form renders with saved `rpe`/`note`/`status` hydrated from `feedback:${date}:data` (or API `notes`/`rpe`/`status`), `disabled` inputs, `pointer-events-none select-none opacity-70`, `cursor-not-allowed` overlay, and `Save Session` replaced by `✓ Session logged — view only`. No blur. Prevents double-submit; `submitFeedback()` early-returns when `feedbackSaved`.
_Avoid_: disabled form, blocked input (use Locked)

**Completed State (Today)**:
When `todayCompleted` is true (`Feedback status=completed` or Strava `Activity` for today exists), `TodayView` shows `ActivityCard` + `Performance Insights` + locked Feedback in the left column and `GoalCard/WeeklyProgression/WeekSchedule` in the right. `nextWorkout` is resolved as the next non-`rest` entry after `isToday`.
_Avoid_: done view, finished screen

**Skip Without RPE**:
`status=skipped` bypasses the `rpe` required check on `POST /plan/feedback` (`rpe` may be `null`). Engine downgrade: `Skipped (plain) → recovery 4km` + marks the skipped date `status: 'skipped'` in `week` and eases **all remaining preferred slots** to `recovery` (Thu + Sat + Sun `4km` after a Wed skip). `Skipped + RPE≥9 → recovery` (high-RPE path only eases next 2 slots). `WeekSchedule` renders `skipped` dimmed (`text-white/40`, `—`, label `Skipped`).
_Avoid_: skip needs RPE

### TrainingPlan Presentation (Figma 9:717 / 9:813)

**TrainingPlanView**:
`views/TrainingPlanView.vue` is a thin orchestrator: header + `WeeklyScheduleGrid` + `NextWeekPreview` + coach-tip card, `gap-6` (24px). Source of truth for layout is Figma `BGtb8qVBrfl4aSzyTBKKa3` node `9:717` (`main-container` `p-32 gap-24`). All spacing uses Tailwind `card #141419` / `muted #A1A1AA` / `primary #F97316` / `border white/10` — no new deps.
_Avoid_: page that re-implements card styling inline; styling lives in the extracted plan components

**WeeklyScheduleGrid** (`components/plan/WeeklyScheduleGrid.vue`):
The 7-day strip. Props `week: Array<{day, date, workout, isToday}>` + `weekLabel: String`. Owns `BADGE_MAP` / `TARGET_MAP`, `fmtShort`, `badgeLabel`, `targetFor`, `isRest`, `distanceText`, `cardClass`. Decision: keep display maps in the component (not the view/store) so the view stays free of presentation constants. Card: `rounded-2xl p-4 gap-4 flex-1 min-w-[124px]`; `isToday → bg-[rgba(249,115,22,0.13)] border-2 border-primary` with `TODAY` pill `bg-primary`; `rest/skipped → bg-card border-white/10 opacity-60`; else `bg-card border-white/10`. Header `14px extrabold` (today `text-primary`) + `11px muted` date via `fmtShort` (`Mon 12:00` to avoid UTC shift); divider `h-px bg-white/10`; badge `9px extrabold uppercase` (`REST DAY bg-white/[0.06] text-muted` vs `RECOVERY/TEMPO… bg-primary/10 text-primary`); distance `22px font-black` (`—` for null); footer `Recovery focus` for rest else `Target: 5:50/km` + `RPE 4`. Layout `flex gap-2.5 overflow-x-auto sm:overflow-visible`.
_Avoid_: rendering week cards inline in the view; `grid 2 / md:7` — Figma is `flex gap-10` 7-col.

**NextWeekPreview** (`components/plan/NextWeekPreview.vue`):
`Preview (Week N – Peak Volume)`. Props `weekNumber: Number` + `items: Array<{badge,title,desc,distance}>` (defaults to Figma mock: `INTERVALS Aerobic Capacity 5x1000m 8.0 km`, `TEMPO RUN Lactate Threshold 5.0 km 9.0 km`, `LONG RUN Endurance Building 14.0 km`). Decision: mock cards are Figma-faithful until `GET /plan/week` exposes a true next-week payload — no fetch added. Layout `flex flex-col gap-3` (12px) outer, `grid 1 / md:3 gap-3`, card `flex items-center gap-4 rounded-2xl border-white/10 bg-card p-4`. Figma fidelity: left col `gap-[6px]` (was `gap-1.5` + `leading-none/snug`) now `gap-[6px]` + `leading-normal` per `9:813/9:814` (`gap-[6px]` badge→title→desc), right `items-end leading-normal`. No `pt-2` — parent `gap-6` already gives 24px as in `main-container gap-24`.
_Avoid_: fetching next-week from client or hard-coding preview inside the view

**Coach Tip Card**:
Static card `bg-card border-white/10 rounded-2xl p-5 gap-4` with `46px bg-primary/10 rounded-xl` icon holder + `LightBulbIcon 22px text-primary` + `15px bold` title `Coaching Tip: The Science of Tapering` + `13px leading-relaxed muted` body. Figma `9:843/9:844`.
_Avoid_: separate tip component until reused elsewhere — keep inline in the view

**LightBulbIcon**:
`components/icons/LightBulbIcon.vue` — Heroicons 24/outline `light-bulb` (raw SVG, `cls` prop, `<!-- heroicons … https://heroicons.com -->`), matching the `FlagIcon` pattern (`fill none`, `stroke-width 1.5`). Used only in the coach-tip card.
_Avoid_: `@heroicons/vue` install or emoji glyph

**Header & Week Label**:
Header left `11px bold uppercase muted` (`Half Marathon Training Plan` via `GOAL_LABELS[goal.goal_type]`) + `32px font-black WEEKLY SCHEDULE`; right taper pill `rounded-full border-primary bg-primary/10 px-3 py-2` with `FlagIcon 14px` — shown when `goal_date` is `0–14d` out (covers Figma `2-Week Training Taper Active`). `weekLabel` is `WEEK {currentWeek} OF {totalWeeks} (AUGUST 25 – AUGUST 31)` from `week[0]/week[6]` `toLocaleDateString month long` uppercased; fallback `WEEK n OF m`.
_Avoid_: hard-coded `Training Plan` string or UTC `toISOString` for week range

**TARGET_MAP / BADGE_MAP**:
Client-only display constants mirroring Figma 9:717 values: `recovery 5:50/4`, `easy 6:00/3`, `long 5:40/5`, `steady 5:25/6`, `tempo 5:15/7`, `threshold 5:00/7`, `interval 4:55/8`. `BADGE_MAP`: `rest→REST DAY`, `recovery→RECOVERY`, `tempo→TEMPO RUN`, etc. Kept inside the grid component so the API doesn't need to grow.
_Avoid_: extending `buildWeekPlan` workout payload for UI-only pace/RPE text

### Progress Presentation (Figma 9:878 — best-effort, rate-limited)

**ProgressView**:
`views/ProgressView.vue` rebuilt to the `9:717` card system (best-effort for `9:878` while Figma MCP is rate-limited). Structure `flex flex-col gap-6`: header (`11px bold uppercase muted Your Journey` + `32px font-black PROGRESS`) → 4-col stat grid → 28-day consistency bar (new) → volume chart → pace/HR 2-col → fatigue card → best-efforts list. No `AppStats` — custom figma cards so every page shares the same `rounded-2xl border-white/10 bg-card p-4/5` language.
_Avoid_: reusing `AppStats` (xs labels) — figma stat cards are `22px font-black` + `11px uppercase muted`.

**Stat Cards (Total Distance / Activities / Trend / Long Run)**:
Each `rounded-2xl border-white/10 bg-card p-4 gap-4`. Label `11px bold uppercase muted`, value `22px font-black text-white` (Trend uses a `9px pill bg-white/[0.06] text-muted` for the trend string). Decision: keep `GET /progress` shape as-is — client formats `totalDistance`, `totalActivities`, `trainingState.trend`, `longRun28`.
_Avoid_: new API fields for display-only formatting

**Consistency Card (new, 28d)**:
`rounded-2xl border-white/10 bg-card p-5 gap-3` shown only when `goalProgress != null` (honest `null` when `<14d` history). Header `11px uppercase muted Consistency — Last 28 Days` + `pct%` pill `bg-primary/10 text-primary`; row `22px black completed/planned`; bar `h-2 bg-white/10` with `bg-primary` fill `width:pct%`. Reuses `GET /progress goalProgress` already computed from `preferred_days.length × 4`.
_Avoid_: separate consistency endpoint or circular progress — bar is cheapest figma-faithful.

**Chart Cards**:
`WeeklyVolumeChart` + `PaceChart` already are `rounded-2xl bg-card p-4` cards — kept as children, outer view just adds `gap-4` grid. When `loading`, progress stat row shows 4 `animate-pulse` skeleton cards `h-[92px]` instead of `AppStats` skeleton.
_Avoid_: unwrapping chart components — they already match the card shape.

**Fatigue & Best Efforts Cards**:
Fatigue: `border-warning/20 bg-card p-5 gap-3`, pill `bg-warning/15 text-warning 9px`, list `gap-2` with `ChevronRightIcon w-4 text-warning`. Best Efforts: `border-white/10 bg-card p-5 gap-4`, header `11px uppercase muted / 11px muted Top 3 by pace`, rows `py-3 border-b border-white/10` with left `14px semibold distance + 11px muted date` and right `18px black pace + 11px /km`. Empty state `No records yet`.
_Avoid_: separate components until reused — inline in the view is enough.

**Figma Fidelity Note**:
`9:878` text could not be read (MCP Starter rate-limit). Rebuilt to the neighbouring `9:717` system (`card #141419`, `muted #A1A1AA`, `primary #F97316`, `Inter`, `gap-6/12/16`) so Progress and TrainingPlan share one visual language; swapped `AppStats` for bespoke cards and added the consistency bar as the "new card" the brief asked for.
_Avoid_: blocking on Figma fetch — ship figma-consistent dark cards now, tighten copy when 9:878 is readable.
