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
