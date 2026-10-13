# MVP-SCOPE — PacePilot

> MoSCoW for the smallest shippable that satisfies BRIEF + PRD. Everything else is Post-MVP.

## MVP (Must)

**Stack & Plumbing**

- Vue 3 + Vite + Pinia + Tailwind, Express 4 + Mongoose, `server/.env` with `MONGODB_URI`, `JWT_SECRET`, `STRAVA_CLIENT_ID/SECRET`.
- Collections: `Athlete`, `Activity`, `ActivityStream`, `TrainingMetric`, `PlannedWorkout`, `WorkoutFeedback`.

**Strava**

- OAuth authorize/callback/status/disconnect + sync (7 endpoints, pagination, backoff, conservative unknown) + demo seeds (20 runs, 5 weeks) when no creds/DB.

**TrainingState**

- `calcTrainingState` over 7/14/28/84d, fatigue signals, trend. Unit pure, no LLM.

**Plan**

- `buildWeekPlan` from TrainingState + Goal (preferred_days, goal_date) → 7 days, taper/deload long scaling, 9 routes, 9 views, WeeklyVolumeChart + PaceChart.

**Today + Feedback**

- Today recommendation with pace/HR/zones, warmup/main/cooldown, purpose + reasons + alternative. Feedback RPE/status/note with skip-without-RPE and week reorder (next hard → recovery).

**Activities & Progress**

- Activities list/detail with streams/laps/trophies, Goals CRUD, Progress (volume series, pace, goalProgress 28d).

**Done =**

- Sync demo → Dashboard/Plan/Today correct, Plan respects preferred_days, Feedback adaptations match table, re-import yields no dupes (Strava dedup by id).

## Should (if <1 day extra)

- Search + sort on activities
- Export filtered view
- HR zone override UI
- Running balance on long runs

## Could (Post-MVP)

- Email/push on 1st, second athlete + RLS, OCR, fully auto activity classification, Strava webhook, mobile PWA, budget targets

## Won't (explicitly out)

- Generic "any sport" auto-detect, cloud hosting (local only v1), separate auth provider, multi-currency settlement

## Milestones (local, single dev)

1. **Day 1:** Express + Mongoose + Strava OAuth + sync + demo seeds
2. **Day 2:** TrainingState + plan templates + week generation
3. **Day 3:** Today + Feedback + adaptation + week reorder
4. **Day 4:** Activities streams/laps + Goals + Progress
5. **Day 5:** Polish + charts + E2E demo test

## Risks

- Strava rate limit → backoff + pagination (mitigated)
- Activity type change → conservative unknown (not brittle parser)
- Mongo live latency → small dataset <1s
