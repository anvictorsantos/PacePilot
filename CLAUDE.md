# CLAUDE.md — PacePilot project context

`AGENTS.md` holds the rules you must follow; this file is the map — what the product is, how the code is laid out, and which contracts must not move. `CONTEXT.md` is the domain glossary: it names every concept (Goal, TrainingState, Workout, Plan, Next Workout, Feedback, RPE, Skipped, Implicit Skip, Feel Window, Downgrade, Deviation, CoachInsight, Note, Goal Progress, WeekMeta, Program Start, Week Alignment, Performance Insights, WeeklyProgression, Locked Feedback) and the words to use in code and copy.

## The product

PacePilot (repo `strava-ai`) is an adaptive running coach. **Strava supplies the evidence, a deterministic training engine decides, an LLM explains.** The plan follows the athlete's goal but bends to recent feel and attendance.

Non-negotiable behaviour:

- **The engine decides, the model explains.** `services/training.service.ts`, `services/plan.service.ts` and `services/plan/*` own the schedule; `services/ai/*` only writes the one-line explanation. A model never picks a workout type, distance or date.
- **Never invent activity data**, and never diagnose a medical condition. Coaching copy is display-only.
- **Dates are local, never UTC.** `localDateStr` server-side, `localDateKey`/`toLocalDateKey` client-side (`client/src/utils/dates.ts`). `isToday` and the Mon–Sun week depend on this; `toISOString().slice(0,10)` shifts the day at midnight in any non-UTC timezone.
- **Adaptation is deterministic and conservative** (CONTEXT.md §Downgrade): RPE 8 drops one intensity step, 9 → recovery, 10 → rest; a plain skip → `recovery 4km` and eases all remaining preferred slots of the week; deviation +25%/−25% drops one step, +40% or −40% → recovery/easy. The most conservative signal wins, and `originalType` on `GET /api/plan/today` prevents a double downgrade against the week.
- **Week 1 is anchored, not drifting:** `getWeekMeta` reads `Athlete.goalSetAt` → `Athlete.createdAt` → earliest activity → a 12-week block, so editing the goal does not reset the programme.
- **Demo mode answers every route** without Strava OAuth or MongoDB. It stays usable.
- **Strava tokens never reach the browser**; they are encrypted at rest and redacted from logs.

## Architecture

Two workspaces, no root package. Client and server are installed and run separately.

### Client — `client/src` (Vue 3 SPA, Vite, TypeScript, Tailwind)

```text
main.ts                    app bootstrap: router guard, Sentry, i18n, mount
router/index.ts            10 routes, each view a dynamic import; / and /login are public
App.vue                    shell: header, sidebar, mobile nav, toast container

services/client.ts         the single data-access module: path registry, axios transport
                           (baseURL /api, cookie auth), unwrap + fallback convention,
                           error classification, apiErrorMessage()
services/logger.ts         Sentry facade: dev console, scrubbing, dedupe

composables/useResource.ts cached reads: in-flight dedupe per key, stale-while-revalidate,
                           data/loading/error/settled/reload; getter keys for paged lists
composables/useDialog.ts   the modal contract: focus trap, Escape, scroll lock, restore, attrs
composables/useSession.ts  Strava connection truth, used by the router guard
composables/useCurrentUser.ts, useCapacity.ts, useToast.ts

run-day/useRunDay.ts       whether today's run happened: local date key, three sources
                           (Feedback → Activity → cache), the feedback:<date> cache triple,
                           submit path, clearRunDayCache()

utils/dates.ts             local date keys
utils/format.ts            pace, distance, duration strings
utils/training-vocabulary.ts  goal labels, workout names, badges, targets, tones, pace —
                           keyed by the WorkoutType/GoalType unions in types/domain.ts
types/domain.ts            the wire contracts the client reads

i18n/index.ts              pt in the entry chunk, en lazy; key `pacepilot-locale`
layouts/                   AppHeader, AppSidebar, MobileNav, NotificationCenter
components/ui/             AppSelect, AppCalendar, AppDropdown, AppInputGroup, ActivityCard,
                           InsightCard, ProgressBar, Skeleton, EmptyState, LegalModal,
                           ToastContainer, LanguageSwitcher, BrandLogo, DayCard, …
components/shared/         GoalCard, WaitlistForm
components/charts/         WeeklyVolumeChart
components/icons/          one local Heroicon SVG component per icon, `cls` prop
features/<area>/           views/ + components/ (+ composables/) per feature area:
                           activities, auth, goals, landing, progress, settings, strava,
                           today, training-plan
```

### Server — `server/src` (Express 4, Node ESM, TypeScript, Mongoose, Zod)

```text
index.ts / app.ts          bootstrap and app factory (separated so the Netlify function
                           adapter can import the factory); helmet, CORS credentials,
                           same-origin check, json limit, rate limiters, routes, error handler
config/env.ts, db.ts       validated env with derived demoMode; Mongoose connect that tolerates
                           an unavailable database so demo mode still answers
errors/AppError.ts         typed operational errors
middleware/auth.ts         requireAuthForUserData, session resolution, cookie JWT
middleware/errorHandler.ts centralized error responses
models/                    Athlete, Activity, WorkoutFeedback, Waitlist
routes/*.routes.ts         strava, activities, plan, goals, progress, me, waitlist, sentry
schemas/                   Zod: feedback, goal, respond
services/strava.service.ts OAuth, token refresh, the Strava endpoints, pagination, backoff
services/activity.service.ts, session.service.ts, training.service.ts
services/plan.service.ts + services/plan/{templates,programme,targets,adaptive,weekMeta}.ts
                           the Plan module: deterministic week, adaptation, week meta
services/training-ai.service.ts + services/ai/{coaching-prompt,coaching-output,
                           coaching-contract,plan-archetypes,quota-cache}.ts
                           the LLM explain layer: prompt, output parsing, contract, archetypes, cache
services/openrouter-client.ts, services/ai/quota-cache.ts
utils/                     pagination, redact, tokenCrypto (token-at-rest encryption),
                           clientIpKey (rate-limit key)
functions/api.mjs          Netlify function adapter (esbuild-bundled at deploy)
scripts/                   verify-ai.mjs, ensure-indexes.mjs
tests/unit/                node --test suites
```

## Contracts to preserve

Endpoint inventory lives in `README.md`. What must not change:

| Area | Invariant |
| --- | --- |
| `GET /api/plan/today` | passes `originalType` so an adapted workout is not downgraded twice |
| `GET /api/plan/week` | `weekMeta { currentWeek, totalWeeks }`, local Mon–Sun dates, `isToday` by local key, `skipped` slots dimmed |
| `POST /api/plan/feedback` | a plain `skipped` needs no RPE; a saved entry locks the form to view-only |
| `GET /api/progress` | `goalProgress` is `null` when history is under 14 days — never faked |
| `GET`/`PUT /api/goals` | `goalSetAt` anchors Week 1 |
| Response shapes | preserved; the client's `types/domain.ts` mirrors them |
| Auth | httpOnly cookie JWT, verified server-side identity; no identity from client input |
| Demo mode | every route answers with seeded data (`services/*` demo branch + seeds) |
| AI | `degraded` is a normal outcome, not a thrown error; the schedule is never model-authored |

## Working in the client

Before a Vue task, read one similar view, the module it reads from, and the relevant token. Then settle: scope, contract (props/emits/route params/response shape), state (module vs local vs `computed`, plus loading/empty/error/retry), UI (mobile-first, existing tokens, local icons), accessibility (keyboard, focus, labels, contrast), and acceptance (the interaction plus which checks to run).

- Figma references still in force: `WeeklyScheduleGrid` is the `9:717` seven-column strip; `NextWeekPreview` follows the `9:813` preview spec (still mock cards until `/plan/week` exposes a next-week payload); `ProgressView` follows `9:878` (header, four stats, 28-day consistency bar, volume/pace charts, fatigue, best efforts); `TodayWorkoutView` is `9:527`–`9:601`.
- `AppHeader` keeps a right-aligned cluster — language switcher, notification bell, profile menu — with the brand mark showing only on mobile (`sm:hidden`).
- The completed state of Today renders from run-day truth: `useTodayWorkout` supplies presentation, `useRunDay` supplies `completed`, `activity`, the locked feedback form and `submitFeedback`.
- Presentational maps (badges, targets, tones, goal labels) come from `utils/training-vocabulary.ts`. Do not re-declare them per surface.
- Tests: `client/src/**/__tests__` with Vitest (`npm test`, 53 tests across services, composables and utils); `client/tests/e2e/a11y.spec.ts` with Playwright + `@axe-core/playwright`.

## Working in the server

Before an endpoint change, read the route, its Zod schema, the service it calls, the auth middleware, the error handler and the client consumer. Then settle: the API contract, where the logic belongs, the trust boundary, the failure paths (invalid input, unauthenticated, missing resource, Strava rate limit or timeout, database unavailable, demo mode) and compatibility with existing consumers.

- Demo mode is derived in `config/env.ts` (missing `STRAVA_CLIENT_ID`, or `DEMO_MODE=true`); it must remain a full-parity path, not a stub.
- The AI layer is quota-bound: `AI_CACHE_TTL_MS` caches a result per athlete-week, `services/ai/quota-cache.ts` tracks the free tier, and `GET /api/plan/ai/status` reports whether the configured model is still free. Both model ids must end in `:free` and come from different upstream providers — the server refuses to boot in production otherwise.
- Rate limits: a general `/api/` limiter plus stricter write limiters on `strava/sync`, `plan/feedback` and `waitlist`, keyed by `utils/clientIpKey.ts`.
- Tests: `npm test --prefix server` (`node --test` over `tests/unit/` — 10 suites spanning the plan engine, the AI layer, the services and the utils). CI does not run them yet — run them locally for a touched service.

## Where to read more

| Document | Covers |
| --- | --- |
| `CONTEXT.md` | domain glossary — the vocabulary for code, copy and reviews |
| `docs/BRIEF.md` | one-pager: why, who, success criteria |
| `docs/PRD.md` | users, journeys, requirements |
| `docs/MVP-SCOPE.md` | MoSCoW scope of the shippable |
| `docs/ai-integration.md` | the OpenRouter free-tier layer, contract and cache |
| `docs/DESIGN-GUIDELINES.md` | visual language (Tailwind tokens, motion, contrast) |
| `docs/LANDING-PAGE-SPEC.md` | the marketing/landing page spec |
| `docs/deployment.md` | Netlify + GitHub Actions architecture and known debt |
| `README.md` | setup, env, scripts, endpoint inventory |
