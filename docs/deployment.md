# Deployment — PacePilot (Render + GitHub Actions)

## Architecture

- One Render web service, `pacepilot` (see `render.yaml`): Node runs the Express
  API and serves `client/dist` from the same origin. No second static host and
  no serverless adapter.
- `server/src/index.ts` listens and passes `client/dist` to `createApp()` as
  `staticDir`; unknown non-`/api` paths fall back to `index.html`.
- Same-origin keeps the client's relative `/api` calls and the httpOnly
  `SameSite=Lax` session cookie working without CORS in production.
- Render's Git auto-deploy is **off**. GitHub Actions deploys one GitHub release
  at a time, after verifying CI passed for that release commit.

## One-time setup (manual, needs account access)

1. Render → New → Blueprint → this repo. The Blueprint is `render.yaml`.
   Build: install client deps with dev deps, build `client/dist`, install server
   deps, typecheck the server. Start: `cd server && npm start`.
   Health check: `/api/health`.
2. Render service → Settings → Deploys: confirm **Auto-Deploy is off**.
   `render.yaml` sets `autoDeployTrigger: off`; a dashboard override wins, so
   check it after the first Blueprint sync.
3. Render → Environment — **prod** (never commit):
   `MONGODB_URI` (Atlas, allow Render egress), `JWT_SECRET`,
   `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`), `STRAVA_CLIENT_ID`,
   `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI=https://<prod>/api/providers/strava/callback`,
   `STRAVA_WEBHOOK_VERIFY_TOKEN`, `STRAVA_WEBHOOK_SUBSCRIPTION_ID`,
   `CLIENT_URL=https://<prod>`, `APP_URL=https://<prod>`,
   `VITE_SENTRY_DSN=<project DSN>`, `VITE_SENTRY_ENV=production`.
   `VITE_SENTRY_RELEASE` is written by the release workflow; do not set it by
   hand. `NODE_ENV=production`, `PORT` and `NODE_VERSION=22.18.0` come from
   Render/the Blueprint.
   Register the push subscription once per environment with
   `npm run webhook:strava --prefix server -- subscribe`; the callback defaults
   to `https://<prod>/api/providers/strava/webhook` and must be HTTPS on 443.
4. Preview environments are optional and not part of production. If enabled,
   give them a separate Atlas database and Strava app/callback, never the prod
   database. Strava allows one webhook subscription per API app; a preview that
   needs push must use its own Strava app, otherwise the pull import covers it.
5. Sentry: project `pacepilot`, environments `production` and `development`.
   Install the Sentry GitHub integration so commits can link to the release.
   Create an org auth token with `project:releases` and `project:write`, then
   set `SENTRY_AUTH_TOKEN` and `SENTRY_ORG=pacepilot-t4` in GitHub.
6. Render → Account Settings → API Keys: create a key and copy the service ID
   from the Render service URL (`srv-...`).
7. GitHub repo → Settings → Environments → `production` (required reviewers).
   Secrets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `RENDER_API_KEY`,
   `RENDER_SERVICE_ID`. No secret in code/logs.
8. Branch protection `main`: require `CI / Client`, `CI / Server` and
   `CI / Security` green, no bypass. GitHub Free private repositories cannot
   enable branch protection or rulesets; upgrade the repository plan or enforce
   the same checks by review convention.

## Flow

- Any branch push and every pull request → `ci.yml`, three parallel jobs:
  - `Client`: lockfile-strict install, `vue-tsc`, lint, format check, tests,
    `vite build`.
  - `Server`: lockfile-strict install, `tsc`, tests, boot check
    (`/api/health` with no database).
  - `Security`: committed-secret scan, `render.yaml` check,
    `npm audit --audit-level=high` for each workspace.
  A branch push and its PR share one concurrency group, so only one run is paid
  for.
- Publish a GitHub release from `main` **after CI is green** → `deploy.yml`
  (env `production`):
  - verify CI succeeded for the release commit;
  - create/finalize the Sentry release named after the tag, with commits linked;
  - write `VITE_SENTRY_RELEASE=<tag>` to the Render service;
  - deploy the release commit through the Render API.
- Same SHA rule: the release tag's commit is the commit CI tested. A push that
  is not part of a release never deploys.
- Manual `workflow_dispatch` takes a release tag and follows the same checks; a
  prerelease is never deployed automatically.

## Vulnerability exceptions

- Both workspaces: zero high/critical, and CI blocks on
  `npm audit --audit-level=high` for each. The client's 19 advisories (2
  critical, via vitest's tinypool) were cleared by taking the minimum version
  that fixes each one — vite 6, vitest 4, tailwind 4, eslint-plugin-vue 10,
  lint-staged 17 — rather than jumping to the latest of each.

## Verify prod

- `GET https://<prod>/api/health` → `{ok:true}`.
- `GET https://<prod>/api/providers/strava/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=smoke`
  → `{"hub.challenge":"smoke"}`; a wrong token is 403, and an unset token is 503.
- Authed route, CORS origin allowlist, cookie flags (`Secure`, `Lax`).
- Strava callback URI matches env. Error shape `{error}` no stack/secret.
- Render deploy log shows the release commit; the service switches only after
  `/api/health` passes.
- Sentry → Releases shows the GitHub tag, `production`, and linked commits. An
  issue resolved “in the current release” displays that tag.
- Local `vite dev` events arrive under `development` when
  `VITE_SENTRY_FORCE=true` in `client/.env.local`.

## Rollback

- App only: Render → service → Deploys → previous live deploy → Rollback.
  No Git change required.
- Bad code: `git revert <sha>`, push via PR, CI green, publish a new release.
- Previous release: run the Release workflow manually with its tag.
- Env change: Render dashboard → edit var → publish a release (revert the var
  and redeploy to undo).
- DB migrations: rollback does **not** reverse schema/data. Keep migrations
  backward-compatible, separate from build, approved explicitly. No auto
  migrate per boot.

## Limits

- Render free web service: one instance, limited CPU/RAM, sleeps after idle.
  Strava sync is bounded per request; no unbounded background loop.
- Rate-limit memory store is per instance and approximate across restarts.
- Mongoose connection is cached per process (`globalThis.__mongoosePromise`).
- No serverless function timeout: the Express process is long-lived, but every
  request still gets an upstream timeout and a bounded page budget.

## Indexes

`WorkoutFeedback` now carries two indexes that it previously lacked:

- `{ athlete: 1, date: -1 }` — every feedback read was a full collection scan
- `{ athlete: 1, date: 1 }` unique — makes the feedback upsert race-free

The unique index cannot be built while duplicate `(athlete, date)` rows exist.
Run once before deploying:

```bash
cd server && npm run db:indexes
```

It de-duplicates (keeping the most recently updated row per pair), then creates
the indexes. Idempotent; safe to re-run. On Atlas or any replica set, indexes are
also built automatically on boot unless `autoIndex` is disabled.

The same script builds the activity retention TTL: Mongo deletes an activity once
`date + 90 days < now`. The window has to cover the plan's 28-day state and the
progress chart's 8 weeks (56 days); 90 is the margin. Changing the window means
rebuilding the index — Mongoose does not alter an existing `expireAfterSeconds`.

Mongoose `autoIndex` is off by default in production builds, so if you deploy
with a replica set the indexes will build on first connect; on a standalone
mongod, run the script explicitly.

## Behaviour changes

- `GET /api/activities?type=<x>` now rejects an unknown workout type with `400`
  instead of silently ignoring the filter and returning every activity. The
  accepted set is derived from the model enum, so it can no longer drift.
- `GET /api/activities/:id` no longer calls Strava on every request. Trophies
  are served from the cached row; pass `?refresh_trophies=1` to force a live
  refresh. Response shape is unchanged.
- `DELETE /api/me` runs inside a transaction where the deployment supports one,
  and reports `"atomic": true|false` so you know which guarantee applied.
- `GET /api/strava/status` now accepts an `Authorization` header as well as the
  cookie; previously a header-only client was told it was not connected.
