# PacePilot — Adaptive Strava Running Coach

Premium MEVN running-coach app. **Strava supplies the evidence, the deterministic training engine decides, the LLM explains.** The week follows your goal but bends to recent feel and attendance.

## Stack

| Workspace | Stack |
| --- | --- |
| `client/` | Vue 3 SPA, Vite, TypeScript, Tailwind CSS, Chart.js + vue-chartjs, vue-i18n (pt + en), Sentry |
| `server/` | Node ESM, Express 4, TypeScript (run via Node type stripping), Mongoose, Zod, helmet, express-rate-limit, OpenRouter (free tier) |

Two workspaces, no root package — install and run each separately.

## Prerequisites

- **Node 22.18+** to run the server locally: `npm run dev` executes `src/*.ts` through Node's type stripping. The client, CI and the deployed function run on Node 20 (Netlify pins `NODE_VERSION=20` and bundles `server/functions/api.mjs` with esbuild).
- **MongoDB** is optional. With none, every route still answers from demo data.

## Quickstart

```bash
# server — http://localhost:3000
cp server/.env.example server/.env        # fill what you need, see below
cd server && npm install && npm run dev

# client — http://localhost:5173 (Vite proxies /api → :3000)
cd client && npm install && npm run dev
```

Minimum for a local run — the rest of `server/.env.example` covers Strava OAuth, OpenRouter, Sentry tunnelling and token encryption, each commented in place:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/pacepilot
JWT_SECRET=a-long-random-string
CLIENT_URL=http://localhost:5173
```

`client/.env.example` holds the optional Sentry settings (`VITE_SENTRY_*`).

### Demo mode

Demo mode is derived, not just a flag: it turns on when `STRAVA_CLIENT_ID` is missing, or when `DEMO_MODE=true` is set explicitly. It seeds realistic runs so the whole UI works without Strava OAuth or MongoDB. Keep it working — it is the fastest way to review any screen.

### Strava OAuth

1. Create an API app at https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to `localhost`
3. Put the Client ID / Secret in `server/.env` and match `STRAVA_REDIRECT_URI` to the registered callback.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | `client`: Vite dev server on :5173 · `server`: `node --watch src/index.ts` on :3000 |
| `npm run preview` (`client`) / `npm start` (`server`) | serve the built SPA / run the API once, no watch |
| `npm run build` (`client`) | production build to `client/dist`, then **fails if any chunk crosses 500 kB** |
| `npm run typecheck` (`client`) | `vue-tsc` over `tsconfig.app.json` — the real check, currently 0 errors |
| `npm run typecheck` (`server`) | prints the missing-`tsconfig.json` debt (see Known debt) |
| `npm run lint` / `format` / `format:check` (`client`) | ESLint (incl. `vuejs-accessibility`) / Prettier |
| `npm test` (`client`) | Vitest — 126 unit tests (domain modules, services, composables, utils) |
| `npm test` (`server`) | `node --test tests/unit/**/*.test.ts` — 10 suites spanning the plan engine, the AI layer, the services and the utils |
| `npx playwright test` (`client`) | end-to-end + `@axe-core/playwright` a11y audit of `tests/e2e/a11y.spec.ts` |
| `npm run verify:ai` (`server`) | exercise the OpenRouter path against the configured free model |
| `npm run db:indexes` (`server`) | ensure MongoDB indexes |

CI: `.github/workflows/ci.yml` (install, typecheck, lint + format, client build, function bundle, secret scan, dependency audit) and `.github/workflows/client-ci.yml` (client lint, test, build on `client/**` changes). The pre-commit hook runs `npm run lint` in `client/`.

## API

All routes are mounted under `/api`. "Session" means the route resolves the httpOnly JWT cookie itself and answers with a null/empty shape when signed out.

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/health` | public | `{ ok: true }` |
| `GET /api/strava/authorize` | public | redirect into Strava OAuth |
| `GET /api/strava/callback` | public | OAuth callback, sets the session cookie |
| `GET /api/strava/status` | session | always 200: `{ connected, last_synced_at }` |
| `GET /api/strava/athlete` | session | 401 signed out, 503 when the database is down |
| `POST /api/strava/sync` | session | imports activities (stricter rate limit) |
| `POST /api/strava/disconnect` | session | clears the session |
| `GET /api/activities` | required | paginated, filterable |
| `GET /api/activities/:id` | required | detail + streams + laps |
| `GET /api/plan/today` | required | today's workout, adapted; `originalType` prevents double downgrade |
| `GET /api/plan/week` | required | 7 days + `weekMeta` + goal |
| `GET /api/plan/feedback` | required | feedback for the current week |
| `POST /api/plan/feedback` | required | `{ date, rpe, note, status }`; a plain `skipped` needs no RPE |
| `GET /api/plan/ai/week` | required | LLM coaching copy; resolves `degraded` when the quota is spent |
| `GET /api/plan/ai/status` | public | whether the configured model is still on the free tier |
| `GET` / `PUT /api/goals` | required | goal CRUD; `goalSetAt` anchors Week 1 |
| `GET /api/progress` | required | training state, volume + pace series, records, `goalProgress` (null under 14 days of history) |
| `GET /api/me` | session | current athlete, or `{ user: null }` |
| `DELETE /api/me` | session | erase the account and its data |
| `GET /api/waitlist/capacity` | public | athlete-slot capacity |
| `POST /api/waitlist` | public | join the waitlist |
| `POST /api/sentry/tunnel` | public | Sentry ingest tunnel |

## Architecture

`CONTEXT.md` is the domain glossary (Goal, TrainingState, Workout, Feedback, RPE, Downgrade, Deviation, WeekMeta, …). `CLAUDE.md` is the annotated map of both workspaces; `AGENTS.md` holds the rules every change follows.

The client's domain lives in `client/src/modules/`, one folder per context, each
split `domain/` (value objects, entities, events, ports) · `application/use-case/`
(the operations) · `infrastructure/` (adapters, wiring, DTOs). Views and
components are presentation only. The layout follows
[domain-events-in-typescript](https://github.com/surisoko/domain-events-in-typescript);
`AGENTS.md` has the table of what goes where.

Four properties are worth knowing before you touch anything:

- **The engine decides, the model explains.** `services/training.service.ts` + `services/plan.service.ts` + `services/plan/*` own the schedule; `services/ai/*` only writes a one-line explanation. Adaptation (RPE, skips, deviation) is deterministic and conservative.
- **Dates are local.** `localDateStr` on the server and `LocalDateKey` on the client; `toISOString().slice(0, 10)` shifts the day at midnight in any non-UTC timezone.
- **State changes publish events.** The one aggregate (`modules/run-day/domain/entity/RunDay.ts`) records `RunDayCompleted`, `FeedbackLogged` and `RunDayCacheCleared`; subscribers announce them and drop the reads they invalidate. A read records nothing, so a re-read cannot claim something happened twice.
- **One data-access seam on each side.** The client reads through `services/client.ts` (path registry, unwrap convention, error classification) and caches through `composables/useResource.ts`; the server keeps HTTP in `routes/`, logic in `services/`, persistence in `models/`.

## Deployment

Netlify serves `client/dist` and rewrites `/api/*` to a single Express function (`server/functions/api.mjs`, esbuild-bundled; `netlify.toml`). GitHub Actions owns production: `.github/workflows/deploy.yml` builds and deploys the same SHA that passed CI. Netlify's own Git auto-publish stays **off** so there is one prod writer. See `docs/deployment.md`.

## Docs

| Document | Covers |
| --- | --- |
| `CONTEXT.md` | domain glossary and vocabulary |
| `docs/BRIEF.md` | why this exists, who it is for, success criteria |
| `docs/PRD.md` | users, journeys, requirements |
| `docs/MVP-SCOPE.md` | MoSCoW scope |
| `docs/ai-integration.md` | the OpenRouter free-tier layer, contract and cache |
| `docs/DESIGN-GUIDELINES.md` | visual language and tokens |
| `docs/LANDING-PAGE-SPEC.md` | landing page spec |
| `docs/deployment.md` | deploy architecture and known debt |

## Known debt

- `server/` has no `tsconfig.json`, so nothing type-checks it: `npm run typecheck --prefix server` prints that debt and CI's typecheck step skips the server. Adding the config is the fix.
- Server unit tests are not in CI yet — run `npm test --prefix server` locally for a touched service.
- `npm audit --prefix client` reports high-severity advisories in the vite 5 / postcss chain; CI runs it report-only, and the fix is a major vite + tailwind upgrade.
- `CONTEXT.md` still names some pre-refactor paths (`views/TrainingPlanView.vue`, `components/plan/WeeklyScheduleGrid.vue`); the concepts are current, the paths have moved under `features/`.
