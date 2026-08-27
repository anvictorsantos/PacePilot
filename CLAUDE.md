# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PacePilot — Adaptive Strava Running Coach (strava-ai)

## Commands

```bash
# server (Express, http://localhost:3000)
cd server && npm install
npm run dev          # watch mode
npm start            # production

# client (Vite + Vue 3, http://localhost:5173 — proxies /api to :3000)
cd client && npm install
npm run dev
npm run build        # -> client/dist
npm run preview

# env
cp server/.env.example server/.env   # then fill STRAVA_*, MONGODB_URI, JWT_SECRET
# without STRAVA_CLIENT_ID the API serves demo data (DEMO_MODE=true implicitly)
```

No tests are configured yet. Linting is not configured yet.

## Stack

MongoDB/Mongoose · Express 4 · Vue 3 + Vite + Pinia + Vue Router · Tailwind CSS · Chart.js + vue-chartjs · Axios

## Structure

```
server/src/
  index.js            Express bootstrap (CORS, cookies, routes, DB)
  config/env.js      validated env, demoMode = !STRAVA_CLIENT_ID || DEMO_MODE=true
  config/db.js        mongoose connect (warns and continues without DB)
  models/             Athlete, Activity, ActivityStream, TrainingMetric, PlannedWorkout, WorkoutFeedback
  routes/             strava, activities, plan, goals, progress (+ health)
  services/           strava.service, activity.service, training.service, plan.service, demo.service
  middleware/         auth (JWT httpOnly cookie), errorHandler
  utils/              pace, pagination
  seeds/demoData.json 20 seeded runs (5 weeks) for demo mode
client/src/
  main.js / App.vue / router/index.js (9 routes)
  stores/             plan, activities, goals, progress
  composables/useStrava.js
  services/api.js     axios instance (baseURL /api)
  components/layout/  AppSidebar, AppHeader (justify-end, no title), MobileNav
  components/ui/      MetricCard, WorkoutCard, ActivityCard, InsightCard, AppDropdown, StravaButton, EmptyState, LoadingSkeleton
  components/charts/  WeeklyVolumeChart (Bar), PaceChart (Line — reusable for pace/HR/elevation/cadence)
  components/coach/   CoachInsight, GoalProgress
  views/              Dashboard, TrainingPlan, TodayWorkout (locked view-only feedback, local-key dates, skipped+recovery handling), Activities, ActivityDetail, Progress, Goals, StravaConnect, Settings
  assets/styles.css   Tailwind directives + scrollbar
```

## Product Spec

`adaptive-strava-running-coach-SKILL.md` is the source of truth. Do not redesign the training methodology, Strava strategy, or adaptive-plan architecture. Key invariants:

- Strava supplies evidence, training engine decides, LLM explains.
- 7 Strava endpoints, conservative classification (unknown when uncertain), rolling windows 7/14/28/42–84d, decision hierarchy safety→goal→consistency→volume→intensity→specificity→performance.
- Never expose Strava tokens to the client. Never invent Strava data. Never diagnose medical conditions.

## Design System

- Palette: `primary #F97316`, `background #0B0B0F`, `card #141419`, `cardSecondary #1A1A21`, `muted #A1A1AA`, `border #27272A`, plus success/warning/danger.
- Tailwind only, no component library. `rounded-xl/2xl`, `border-white/10`, Inter font via Google Fonts.
- Icons: [Heroicons](https://heroicons.com) — do NOT install `@heroicons/vue`. For every icon, download its SVG from the site and create a dedicated component in `client/src/components/icons/*.vue` (one file per icon, wrapping the raw SVG with a `cls` prop). Do not use emoji/unicode glyphs for icons.
- Dark sidebar on desktop, bottom nav on mobile. Orange for active nav + CTAs.
- `AppHeader.vue` is `justify-end` — the `PACEPILOT` + `{{ title }}` left block was removed; header only shows `Demo data` pill + bell `AppDropdown` + profile `AppDropdown` on the right.

## API Routes

`GET /api/health`, `GET|POST /api/strava/*`, `GET /api/activities` (paginated, filterable), `GET /api/activities/:id` (detail+streams+laps), `GET /api/plan/today` (uses `originalType` to avoid double downgrade), `GET /api/plan/week` (+ `weekMeta {currentWeek,totalWeeks}` via `getWeekMeta`, `Mon–Sun` `localDateStr` alignment, `skipped` status dimmed, plain skip → all remaining `recovery 4km`), `POST /api/plan/feedback` (plain `skipped` now `recovery`, no RPE required; view-only lock `opacity-70` no blur), `GET|PUT /api/goals` (`goalSetAt` anchors Week 1), `GET /api/progress`.

In demo mode (no DB or no Strava creds) every route serves seeded data via `demo.service.js`.
