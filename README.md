# PacePilot — Adaptive Running Coach

Premium running-coach app. **A connected provider supplies the evidence (Strava first), the deterministic training engine decides, the LLM explains.** The week follows your goal but bends to recent feel and attendance.

## Stack

| Workspace | Stack |
| --- | --- |
| `client/` | Vue 3 SPA, Vite, TypeScript, Tailwind CSS, Chart.js + vue-chartjs, vue-i18n (pt + en), Sentry |
| `server/` | Node ESM, Express 4, TypeScript (run via Node type stripping), Mongoose, Zod, helmet, express-rate-limit, OpenRouter (free tier) |

Two workspaces, no root package — install and run each separately.

## Prerequisites

- **Node 22.18+** everywhere: the server runs `src/*.ts` through Node's type stripping, and CI and Render pin `22.18.0` so the test runner sees the same glob and TS behaviour as local.
- **MongoDB** holds the data. Without it the server still boots — `/api/health` and `/api/providers/status` answer, and the routes that need data return 503 instead of inventing any.

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

`client/.env.example` holds the optional Sentry settings (`VITE_SENTRY_*`) and the optional Google Analytics settings (`VITE_GA4_MEASUREMENT_ID`, `VITE_ANALYTICS_DEBUG`). Local dev reports as `development` when `VITE_SENTRY_FORCE=true`; production reports the GitHub release tag. With no measurement id the GA4 tag is never loaded, no hit is queued, and the consent banner still asks so the answer is stored either way.

### No demo mode

There is no seeded or fake data path: a connected provider (Strava today) is the only source of activities, and MongoDB is where they live. Without credentials you can still boot the server and exercise the two status routes, but the plan, progress and activity screens need a connected athlete. (The product docs under `docs/` still describe the demo mode that was removed — that is documentation drift, not a feature.)

### Strava OAuth

1. Create an API app at https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to `localhost`
3. Put the Client ID / Secret in `server/.env` and match `STRAVA_REDIRECT_URI` to the registered callback.

Providers are enabled with `PROVIDERS_ENABLED` (default `strava`). After deploying the provider model, run `npm run db:migrate-providers --prefix server` once to copy legacy athlete tokens into `Connection` rows and backfill activity provider ids; it also repairs an expiry migrated from the legacy epoch-seconds column, so running it again is safe. `-- --dry-run` reports without writing.

### Strava push subscription

A new run arrives by push instead of waiting for the next pull. The endpoint is
`GET|POST /api/providers/strava/webhook` — no session, and the handshake plus the
subscription id are its authentication. The fifteen-minute import window stays
as the fallback when a delivery is missed.

1. Set `STRAVA_WEBHOOK_VERIFY_TOKEN` (a long random string) on the deployment.
2. Make the callback publicly reachable at
   `https://<host>/api/providers/strava/webhook`; override
   `STRAVA_WEBHOOK_CALLBACK_URL` when the API host differs from the SPA host.
3. Register the subscription once per environment:

   ```bash
   npm run webhook:strava --prefix server -- status
   npm run webhook:strava --prefix server -- subscribe
   ```

4. Put the returned id in `STRAVA_WEBHOOK_SUBSCRIPTION_ID` and redeploy. Until
   both values are set the endpoint answers `503` and the pull import continues.

Strava allows one subscription per API app, so each environment (preview, prod)
needs its own app or must share the subscription deliberately.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | `client`: Vite dev server on :5173 · `server`: `node --watch src/index.ts` on :3000 |
| `npm run preview` (`client`) / `npm start` (`server`) | serve the built SPA / run the API once, no watch |
| `npm run build` (`client`) | production build to `client/dist`, then **fails if any chunk crosses 500 kB** |
| `npm run typecheck` (`client`) | `vue-tsc` over `tsconfig.app.json` — the real check, currently 0 errors |
| `npm run typecheck` (`server`) | `tsc` over a strict `tsconfig.json` — blocking in CI, currently zero errors |
| `npm run lint` / `format` / `format:check` (`client`) | ESLint (incl. `vuejs-accessibility`) / Prettier |
| `npm test` (`client`) | Vitest — 126 unit tests (domain modules, services, composables, utils) |
| `npm test` (`server`) | `node --test tests/unit/**/*.test.ts` — 10 suites spanning the plan engine, the AI layer, the services and the utils |
| `npx playwright test` (`client`) | end-to-end + `@axe-core/playwright` a11y audit of `tests/e2e/a11y.spec.ts` |
| `npm run verify:ai` (`server`) | exercise the OpenRouter path against the configured free model |
| `npm audit --prefix server\|client --audit-level=high` | dependency advisory gate; CI blocks on high/critical in both workspaces |
| `npm run db:indexes` (`server`) | ensure MongoDB indexes |
| `npm run db:migrate-providers` (`server`) | backfill connections/provider ids; add `-- --dry-run` |
| `npm run webhook:strava` (`server`) | inspect/create/delete the Strava push subscription for this environment |

CI: `.github/workflows/ci.yml` runs three parallel jobs — `Client` (typecheck, lint, format, tests, build), `Server` (typecheck, tests, boot check), and `Security` (secret scan, deploy config, dependency audits). Actions use their current major version tags, the token is read-only, and superseded runs cancel. The pre-commit hook runs `npm run lint` in `client/`.

## API

All routes are mounted under `/api`. "Session" means the route resolves the httpOnly JWT cookie itself and answers with a null/empty shape when signed out.

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/health` | public | `{ ok: true }` |
| `GET /api/providers` | public | enabled sources + capabilities |
| `GET /api/providers/status` | session | aggregated connection state |
| `GET /api/providers/:provider/authorize` | session | redirect into the provider's OAuth |
| `GET /api/providers/:provider/callback` | public | OAuth callback, links the source and/or sets the session |
| `GET /api/providers/:provider/status` | session | always 200: `{ connected, last_synced_at }` |
| `GET /api/providers/:provider/athlete` | session | profile; 401 signed out, 503 DB-down |
| `POST /api/providers/:provider/sync` | session | imports activities (stricter rate limit) |
| `GET /api/providers/:provider/backfill` | session | historical-import cursor state; no provider call |
| `POST /api/providers/:provider/backfill` | session | one bounded step below the import cap (stricter rate limit) |
| `POST /api/providers/:provider/backfill/stop` | session | pauses the walk; the stored cursor is the resume point |
| `POST /api/providers/:provider/disconnect` | session | revokes the grant, keeps the account |
| `GET /api/providers/:provider/webhook` | provider | subscription handshake; 503/403 when unconfigured or the token is wrong |
| `POST /api/providers/:provider/webhook` | provider | push delivery; 401 for a foreign subscription, 200 for an ignored athlete |
| `/api/strava/*` | alias | forwards to the generic routes for one release |
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

Both workspaces are layered the same way — `domain` · `application` ·
`infrastructure`, with `ui` on top, and the dependency rule pointing inwards:

| Workspace | Layout |
| --- | --- |
| `client/src/modules/` | one folder per context (`training`, `run-day`, `feedback`, `activities`, `goals`, `progress`, `account`, `connections`, `auth`, `waitlist`, `ai`, `shared`), each with `domain/` (value objects, the aggregate, events, ports) · `application/use-case/` (the operations and their subscribers) · `infrastructure/` (adapters, wiring, DTOs) · `ui/` (presentation). `features/`, `components/` and `layouts/` are the ui layer for screens. |
| `server/src/modules/` | the same shape (`training`, `ai`, `activities`, `providers`, `athlete`, `auth`, `progress`, `waitlist`, `observability`, `shared`): pure rules in `domain/`, operations in `application/`, and the HTTP edge, Zod schemas, Mongoose documents and provider clients in `infrastructure/`. `app.ts` is the composition root. |

Every import resolves through the `@/` alias (no `../` traversals): the client via
`vite.config.js` + `tsconfig.app.json`, the server via `tsconfig.json` `paths` plus
a ~10-line Node resolution hook (`server/scripts/register-alias.mjs`) that `dev`,
`start` and `test` load — Node does not read tsconfig on its own.

The pattern follows
[domain-events-in-typescript](https://github.com/surisoko/domain-events-in-typescript)
and the DDD practices in
[Domain-Driven Design in TypeScript](https://spaceout.pl/domain-driven-design-in-typescript);
`AGENTS.md` has the table of what goes where and the rules that follow from it.

Four properties are worth knowing before you touch anything:

- **The engine decides, the model explains.** `modules/training/` owns the schedule; `modules/ai/` only writes a one-line explanation. Adaptation (RPE, skips, deviation) is deterministic and conservative.
- **Dates are local.** `localDateStr` on the server and `LocalDateKey` on the client; `toISOString().slice(0, 10)` shifts the day at midnight in any non-UTC timezone.
- **State changes publish events.** The one aggregate (`modules/run-day/domain/entity/RunDay.ts`) records `RunDayCompleted`, `FeedbackLogged` and `RunDayCacheCleared`; subscribers announce them and drop the reads they invalidate. A read records nothing, so a re-read cannot claim something happened twice.
- **One data-access seam on each side.** The client reads through `modules/shared/infrastructure/http/client.ts` (path registry, unwrap convention, error classification) and caches through `modules/shared/infrastructure/cache/useResource.ts`; the server keeps HTTP in each context's `infrastructure/routes/`, the operations in `application/` and persistence in `infrastructure/persistence/`.

## Deployment

Render runs one Node service that serves both the Express API and `client/dist` from the same origin. Render's Git auto-deploy is **off**; each GitHub release is checked against CI, recorded as a Sentry release, and deployed to Render. See `docs/deployment.md`.

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
| `docs/plans/coach-athlete-relationship.md` | one coach to many athletes, one coach per athlete |
| `docs/plans/coach-athlete-implementation.md` | delivery slices, release order and rollback for the coach feature |
| `docs/deployment.md` | deploy architecture and known debt |

## Known debt

- Some server route handlers still hold logic rather than delegating to an `application/` use case. The progress read model is extracted (`modules/progress/application/build-progress.ts`); the OAuth callback and `me` routes are the next candidates.
- The a11y end-to-end spec (`client/tests/e2e/a11y.spec.ts`) assumes an authenticated app: without a session the authenticated routes redirect to `/login`, so seven of its checks (contrast on five pages, plus the LegalModal and ToastContainer component specs) fail on a fresh checkout. It needs a session fixture or a mocked API.
- `CONTEXT.md` says `GET /api/progress` returns `goalProgress: null` whenever there is under 14 days of history. The engine also reports once a run was completed, so a short-but-active history yields a real percentage. The behaviour is preserved as-is; the glossary is the looser of the two.
- The client's stock-palette one-offs (`bg-emerald-500`, `text-zinc-800`, `border-red-600` in the toast and dropdown) predate the token system and are not part of it.
