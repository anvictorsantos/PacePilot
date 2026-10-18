# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PacePilot — Adaptive Strava Running Coach (strava-ai)

## Commands

```bash
# server — Express 4, ESM, http://localhost:3000
cd server && npm install
npm run dev          # node --watch src/index.js
npm start            # production

# client — Vite + Vue 3, http://localhost:5173 (proxies /api → :3000)
cd client && npm install
npm run dev
npm run build        # → client/dist
npm run preview

# env (server)
cp server/.env.example server/.env   # fill STRAVA_*, MONGODB_URI, JWT_SECRET
# demo mode = !STRAVA_CLIENT_ID || DEMO_MODE=true → seeded data, no OAuth/DB needed
```

No tests, no linting configured. Node 18+ required. `client` deps: vue, pinia, vue-router, chart.js+vue-chartjs, axios, tailwind. `server` deps: express, mongoose, axios, jsonwebtoken, zod, cookie-parser, cors, dotenv.

## Architecture

```
server/src/
  index.js               Express bootstrap (CORS creds, cookies, routes, DB) — single file
  config/env.js         validated env; demoMode derived, not just a flag
  config/db.js           mongoose connect — warns & continues without DB (demo still works)
  models/                Athlete, Activity, ActivityStream, TrainingMetric, PlannedWorkout, WorkoutFeedback
  routes/                strava, activities, plan, goals, progress, me (+ health inline in index.js)
  services/              strava.service (OAuth/refresh/7 endpoints/rate-limit), activity.service, training.service, plan.service, demo.service
  middleware/            auth (JWT httpOnly cookie), errorHandler
  utils/                 pace, pagination
  seeds/demoData.json    20 seeded runs / 5 weeks

client/src/
  main.js / App.vue / router/index.js   8 routes: / → /workout redirect, /plan /workout /activities /activities/:id /progress /goals /strava /settings
  stores/                plan, activities, goals, progress (Pinia)
  composables/           useStrava, useAthleteBadge, useCurrentUser, useToast
  services/api.js        axios { baseURL: '/api', withCredentials: true }
  components/layout/     AppSidebar (desktop), MobileNav (Today/Plan/Runs/Progress), AppHeader (justify-end: Demo pill + bell + profile only)
  components/ui/         AppDropdown, AppCalendar, AppSelect, AppInputGroup, ActivityCard, WorkoutCard, MetricCard, InsightCard, EmptyState, LoadingSkeleton, Skeleton, AppDivider, AppStats
  components/charts/     WeeklyVolumeChart (Bar), PaceChart (Line — reused for pace/HR/elevation/cadence)
  components/coach/      CoachInsight, GoalProgress
  components/plan/       WeeklyScheduleGrid (Figma 9:717 7-col strip, owns BADGE_MAP/TARGET_MAP), NextWeekPreview (Figma 9:810/9:813, Peak Volume)
  components/activity/   ActivityHeader, KeyMetricsGrid, DistanceLoadCard, LapsTable, PaceHrChart, SplitsBarCard
  components/progress/   GoalCard, ConsistencyCard, IntensityCard, PaceTrendCard, BestEffortsCard, FatigueCard, ProgressDetailCard, ProgressStatsGrid, ProgressSkeleton, ProgressImage11Card
  components/icons/      one file per Heroicon SVG (cls prop) — AppMarkIcon, FlagIcon, LightBulbIcon, etc.
  views/                 TrainingPlanView (orchestrator: header + WeeklyScheduleGrid + NextWeekPreview + tip), TodayWorkoutView (locked view-only feedback, local-key dates, skipped→recovery 4km), ActivitiesView, ActivityDetailView, ProgressView (Figma 9:878: header + 4 stat cards + 28d consistency bar + WeeklyVolume/Pace/HR + fatigue + best-efforts), GoalsView, StravaConnectView, SettingsView
  assets/styles.css      Tailwind directives + scrollbar
  vite.config.js         alias @ → src, dev proxy /api → :3000
```

**Training engine** (`training.service.js` + `plan.service.js`) is pure/deterministic. Rolling windows 7/14/28/84d (`calcTrainingState`, `weeklyVolumeSeries`). Decision hierarchy: safety → goal → consistency → volume → intensity → specificity → performance. `plan.service.js` templates: recovery/easy/long/steady/tempo/threshold/interval; adaptive feedback downgrades next workout on RPE≥8 or skipped (plain skip → `recovery 4km` for all remaining week slots), uses `localDateStr` (not UTC) for `isToday`/`Mon–Sun` alignment, `getWeekMeta` anchors Week 1 on `goalSetAt > athlete.createdAt > earliest activity`.

## Product Invariants

`adaptive-strava-running-coach-SKILL.md` is source of truth. Do not redesign methodology/Strava strategy/plan architecture.

- Strava supplies evidence, training engine decides, LLM explains.
- 7 Strava endpoints, conservative classification (unknown when uncertain), rolling windows, hierarchy above.
- Never expose Strava tokens to client. Never invent Strava data. Never diagnose medical conditions.

## Design System

- Palette: `primary #F97316`, `background #0B0B0F`, `card #141419`, `cardSecondary #1A1A21`, `muted #A1A1AA`, `border #27272A` + success/warning/danger.
- Tailwind only, no component library. `rounded-xl/2xl`, `border-white/10`, Inter via Google Fonts.
- Icons: [Heroicons](https://heroicons.com) — do NOT install `@heroicons/vue`; download SVG, create `client/src/components/icons/*.vue` with `cls` prop. No emoji glyphs.
- Dark sidebar desktop, bottom nav mobile. Orange = active + CTAs.
- `AppHeader.vue` is `justify-end` (no left title block).

## API Routes

`GET /api/health` (→ `{ok, demo}`), `GET|POST /api/strava/*` (authorize/callback/status/sync/disconnect), `GET /api/activities` (paginated, filterable), `GET /api/activities/:id` (detail+streams+laps), `GET /api/plan/today` (uses `originalType` to avoid double downgrade), `GET /api/plan/week` (+ `weekMeta {currentWeek,totalWeeks}` via `getWeekMeta`, `Mon–Sun` `localDateStr`, `skipped` dimmed, plain skip → remaining `recovery 4km`), `POST /api/plan/feedback` (plain `skipped` → `recovery`, no RPE required; view-only lock `opacity-70`), `GET|PUT /api/goals` (`goalSetAt` anchors Week 1), `GET /api/progress`, `GET /api/me`. In demo mode every route serves `demo.service.js` seeded data.

## Reporting Style

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.
