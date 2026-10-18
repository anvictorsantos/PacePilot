# CLAUDE.md — PacePilot project context

`AGENTS.md` holds the rules you must follow; this file is the map — what the product is, how the code is laid out, and which contracts must not move. `CONTEXT.md` is the domain glossary: it names every concept (Goal, TrainingState, Workout, Plan, Next Workout, Feedback, RPE, Skipped, Implicit Skip, Feel Window, Downgrade, Deviation, CoachInsight, Note, Goal Progress, WeekMeta, Program Start, Week Alignment, Performance Insights, WeeklyProgression, Locked Feedback) and the words to use in code and copy.

## The product

PacePilot (repo `strava-ai`) is an adaptive running coach. **Strava supplies the evidence, a deterministic training engine decides, an LLM explains.** The plan follows the athlete's goal but bends to recent feel and attendance.

Non-negotiable behaviour:

- **The engine decides, the model explains.** `services/training.service.ts`, `services/plan.service.ts` and `services/plan/*` own the schedule; `services/ai/*` only writes the one-line explanation. A model never picks a workout type, distance or date.
- **Never invent activity data**, and never diagnose a medical condition. Coaching copy is display-only.
- **Dates are local, never UTC.** `localDateStr` server-side, and the `LocalDateKey` value object client-side (`modules/shared/domain/value-object/LocalDateKey.ts`). `isToday` and the Mon–Sun week depend on this; `toISOString().slice(0,10)` shifts the day at midnight in any non-UTC timezone.
- **Adaptation is deterministic and conservative** (CONTEXT.md §Downgrade): RPE 8 drops one intensity step, 9 → recovery, 10 → rest; a plain skip → `recovery 4km` and eases all remaining preferred slots of the week; deviation +25%/−25% drops one step, +40% or −40% → recovery/easy. The most conservative signal wins, and `originalType` on `GET /api/plan/today` prevents a double downgrade against the week.
- **Week 1 is anchored, not drifting:** `getWeekMeta` reads `Athlete.goalSetAt` → `Athlete.createdAt` → earliest activity → a 12-week block, so editing the goal does not reset the programme.
- **Demo mode answers every route** without Strava OAuth or MongoDB. It stays usable.
- **Strava tokens never reach the browser**; they are encrypted at rest and redacted from logs.

## Architecture

Two workspaces, no root package. Client and server are installed and run separately.

### Client — `client/src` (Vue 3 SPA, Vite, TypeScript, Tailwind)

The domain follows the layout of the reference project
(`domain-events-in-typescript`, `src/modules/users`): one folder per context under
`modules/`, each split into `domain/`, `application/` and `infrastructure/`.
Views and components are the presentation layer on top; they hold no rules.

```text
modules/shared/               what every context needs
  domain/value-object/        ValueObject, StringValueObject, EnumValueObject,
                              Uuid, LocalDateKey (the local-day rule)
  domain/                     DomainEvent, AggregateRoot, DomainEventSubscriber, EventBus
  infrastructure/EventBus/    DomainEventSubscribers, InMemoryAsyncEventBus
  infrastructure/container.ts bind/get/getAll/bindSingleton
  infrastructure/resource-keys.ts  the keys useResource is read under

modules/run-day/              the one aggregate in the client
  domain/entity/RunDay.ts     completed / activityId / feedback; complete(),
                              logFeedback() and clear() record events
  domain/event/               RunDayCompleted, FeedbackLogged, RunDayCacheCleared
  domain/value-object/RunDayCacheKey.ts   the feedback:<date> cache triple
  domain/repository/          the port (cache + two API reads)
  domain/service/             RunDayNotifier port
  application/use-case/       RefreshRunDay, SubmitRunDayFeedback, ClearRunDayCache
  application/use-case/subscriber/  AnnounceFeedbackLogged,
                              InvalidateStaleReadsOnFeedbackLogged
  infrastructure/repository/  LocalStorageRunDayRepository
  infrastructure/composable/useRunDay.ts  the Vue projection components bind to
  infrastructure/container/run-day-container.ts  the wiring

modules/training/             WorkoutType (enum + predicates), WeekMeta, and the
                              plan DTOs (PlanDay, PlanWorkout, PlanRecommendation,
                              PlanWeekResponse, PlanTodayResponse, PlanProgramme)
modules/feedback/             FeedbackStatus (enum), Rpe (1–10 value object),
                              PlanFeedback DTO
modules/goals/                GoalType (enum + label keys + long-run targets), Goal DTO
modules/activities/           ActivityFilter (value object: chips + query param +
                              matching), Activity/Lap/Trophy/Streams DTOs
modules/progress/             ProgressResponse + TrainingState, VolumePoint,
                              PacePoint, GoalProgress, PersonalRecord DTOs
modules/account/              CurrentUser, StravaStatus, SyncResult, WaitlistCapacity
modules/ai/                   PlanAiWeekResponse, PlanAiDay, PlanAiSuggestion, AiStatusResponse

services/client.ts            the transport: path registry, unwrap convention,
                              error classification, apiErrorMessage()
services/logger.ts            Sentry facade: dev console, scrubbing, dedupe

composables/useResource.ts    cached reads: in-flight dedupe per key,
                              stale-while-revalidate, data/loading/error/settled/reload
composables/useDialog.ts      the modal contract: focus trap, Escape, scroll lock,
                              focus restore, role/aria-modal/name attrs
composables/useSession.ts     Strava connection truth, used by the router guard
composables/useCurrentUser.ts, useCapacity.ts, useToast.ts (+ ToastType, ToastPosition)

utils/training-vocabulary.ts  the presentation mapping: badges, tones, targets,
                              goal labels, pace strings — the only place a display
                              string is declared, resolved through the catalogue
utils/format.ts               pace / distance / duration formatting

i18n/index.ts                 pt in the entry chunk, en lazy; key `pacepilot-locale`
router/index.ts               one route per view, dynamic imports; `meta.public`
layouts/                      AppHeader, AppSidebar, MobileNav, NotificationCenter
components/{ui,shared,charts,icons}/   presentational, no domain rules
features/<area>/              views/ + components/ (+ composables/) per feature area:
                              activities, auth, goals, landing, progress, settings,
                              strava, today, training-plan
```

Layering, enforced by the eslint boundary rule and by review: `domain/` imports no
framework and no app module beyond other `domain/` code; `application/` orchestrates
domain objects and publishes their events; `infrastructure/` supplies adapters and
wiring; `features/` and `components/` consume all of it and decide nothing.

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
| Response shapes | preserved; the client mirrors them as one DTO file per concept under `modules/*/infrastructure/dto/` |
| Auth | httpOnly cookie JWT, verified server-side identity; no identity from client input |
| Demo mode | every route answers with seeded data (`services/*` demo branch + seeds) |
| AI | `degraded` is a normal outcome, not a thrown error; the schedule is never model-authored |

## Working in the client

Before a Vue task, read one similar view, the module it reads from, and the relevant token. Then settle: scope, contract (props/emits/route params/response shape), state (module vs local vs `computed`, plus loading/empty/error/retry), UI (mobile-first, existing tokens, local icons), accessibility (keyboard, focus, labels, contrast), and acceptance (the interaction plus which checks to run).

- Figma references still in force: `WeeklyScheduleGrid` is the `9:717` seven-column strip; `NextWeekPreview` follows the `9:813` preview spec (still mock cards until `/plan/week` exposes a next-week payload); `ProgressView` follows `9:878` (header, four stats, 28-day consistency bar, volume/pace charts, fatigue, best efforts); `TodayWorkoutView` is `9:527`–`9:601`.
- `AppHeader` keeps a right-aligned cluster — language switcher, notification bell, profile menu — with the brand mark showing only on mobile (`sm:hidden`).
- The completed state of Today renders from run-day truth: `useTodayWorkout` supplies presentation, and `modules/run-day/infrastructure/composable/useRunDay.ts` supplies `completed`, `activity`, the locked feedback form and `submitFeedback`. The rules behind those — the local date key, the three sources, the RPE requirement — live in `modules/run-day/`, and logging feedback publishes an event that drops the now-stale `plan.week` and `progress.summary` reads.
- Presentational maps (badges, targets, tones, goal labels) come from `utils/training-vocabulary.ts`. Do not re-declare them per surface.
- Tests: `client/src/**/__tests__` with Vitest (`npm test`, 126 tests — the domain modules carry most of them, since the ports let the aggregates and use cases be exercised without a browser); `client/tests/e2e/a11y.spec.ts` with Playwright + `@axe-core/playwright`.

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
