# PRD — PacePilot

> **Status (Oct 2026):** demo mode was removed from the server — there is no seeded data path. Activity data comes from Strava OAuth and lives in MongoDB; without a database the data routes answer 503. See `README.md` for current behaviour, and treat the demo references below as historical scope.

## 1. Users

- **Runner (operator):** Connects Strava, sets goal (5K/10K/half/marathon) + preferred_days + goal_date, checks Today/Plan/Progress, gives Feedback (RPE 1–10, status completed/skipped, note).
- **Engine (deterministic):** Pure functions over Strava activities — decides TrainingState, plan, and adaptations. Never LLM.
- **CoachInsight (LLM explain):** One-line human explanation for adapted workouts; reads note but never decides. Never medical.

## 2. User Stories (must-have)

1. As Runner I connect Strava → OAuth → sync → Dashboard shows weekly distance, hard sessions, trend, fatigue signals.
2. As Runner I set goal half_marathon + preferred Tue/Wed/Thu/Sat/Sun + goal_date → Plan generates 7 days, rest on non-preferred.
3. As Runner I open Today → I see Workout (type/distance/intensity/target pace/HR/warmup/main/cooldown/purpose + Why).
4. As Runner I complete a run → Strava activity appears in Activities (paginated, filterable) with streams (time/distance/velocity/HR/cadence/elevation) and laps.
5. As Runner I give Feedback RPE 8 for today → next workout downgrades one step (tempo→steady).
6. As Runner I skip recovery → I hit Skipped (no RPE required) → save → Week reorders: next hard tempo on preferred day becomes recovery/easy, second hard softens one step.
7. As Runner I overrun long by +40% → next workout becomes recovery (deviation).
8. As Runner with goal in 7d → Plan tapers long run to 60%; 14d → deload to 80%.
9. As Runner I open Progress → I see volume series (8 weeks), pace, goalProgress (28d consistency).

## 3. Functional Requirements

### 3.1 Strava Integration

- OAuth: `GET /api/strava/authorize` → redirect, `GET /api/strava/callback`, `GET /api/strava/status`, `POST /api/strava/sync` (paginated, rate-limit backoff), `POST /api/strava/disconnect`.
- 7 endpoints, conservative classification (unknown when uncertain), rolling windows 7/14/28/42–84d, hierarchy safety→goal→consistency→volume→intensity→specificity→performance.
- Tokens: httpOnly JWT cookie, never exposed to client, never logged. No demo mode: activity data comes from Strava and lives in MongoDB; without a database the data routes answer 503.

### 3.2 TrainingState (training.service.js)

- Inputs: normalized activities. Outputs: `weekly{ distance7/14/28/84, runs7/14/28, longRun7/28, avgPace7/28, avgHr7/28, hardSessions7/14 }`, `intensityDistribution (28d)`, `consistency{ runsPerWeek28, longestGapDays }`, `trend (building/stable/reducing)`, `fatigueSignals[]`, `hasFatigueSignal`.

### 3.3 Plan & Adaptation (plan.service.js)

- `WORKOUT_TEMPLATES`: recovery 4km/25m/very easy, easy 6/35/easy, long 12/75/easy, steady 8/45/moderate, tempo 7/40/tempo, threshold 8/45/threshold, interval 7/45/hard.
- `buildWeekPlan(state, goal, startDate, feedbacks, activities)`: maps preferred_days to pattern `easy/tempo/easy/long` (taper `easy/tempo/easy/long/easy`, deload `easy/steady/easy/long`), assigns rest otherwise, then adaptive swap for isToday (Feel Window 7d + deviation 3d) and week reorder on skipped (see BRIEF).
- `recommendNextWorkout` / `buildRecommendationForType`: target pace from 28d avgPace, target HR from Athlete.zones or fallback, alternative note.

### 3.4 Feedback (Adaptive Loop)

- `POST /api/plan/feedback { date, rpe 1–10, note, status }`, `GET /api/plan/feedback` (7d window). Skipped without RPE allowed (button enabled when status===skipped). The client caches the last feedback locally (`feedback:YYYY-MM-DD`) so a reload shows the locked form.
- Downgrade: RPE 8→drop one, RPE 9→recovery, RPE 10→rest; Skipped→easy, Skipped+RPE≥9→recovery; Deviation +25%→downgrade, +40%/+5km→recovery, −25%→downgrade, −40%→easy. Most conservative wins.

### 3.5 Dashboard/Progress/Goals

- `GET /api/plan/today`, `GET /api/plan/week`, `GET /api/activities` (paginated, filterable), `GET /api/activities/:id` (detail+laps+streams), `GET|PUT /api/goals`, `GET /api/progress`.

## 4. Non-Functional

- Local Vite (5173 proxies /api to 3000) + Express, MongoDB required for data routes; parse 500 runs <1s, dashboard <1s.
- No PII in logs; raw Strava data retained but not displayed by default.
- Single athlete v1, no RLS.

## 5. Out of Scope (v1)

Multi-athlete, medical diagnosis, any-sport, OCR, cloud deploy, mobile PWA, auto bank sync.

## 6. Acceptance Criteria

- Connect + sync → Dashboard correct, Plan respects preferred_days + taper.
- RPE/skip/deviation adaptations match table, Today + Week reorder visible, Progress correct.
