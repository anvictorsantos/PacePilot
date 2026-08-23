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
Deterministic adaptation of the next `Workout` type due to recent Feedback or Deviation: `RPE 8 → drop one intensity step (e.g. tempo→steady)`, `RPE 9 → recovery`, `RPE 10 → rest`; `Skipped → easy`, `Skipped + RPE≥9 → recovery`; `Deviation +25% over planned distance → downgrade one`, `+40% or +5km → recovery`, `−25% under → downgrade one`, `−40% → easy`. Applied to the next workout only; most conservative signal wins.
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
