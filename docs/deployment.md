# Deployment — PacePilot (Netlify + GitHub Actions)

## Architecture

- `client/dist` → Netlify CDN (static).
- `server/src` Express app → Netlify Function `server/functions/api.mjs`
  via `serverless-http`. Factory `server/src/app.js` shared, no route dup.
  `server/src/index.ts` only listens (local / alt host).
- Rewrite `/api/*` → `/.netlify/functions/api/:splat` preserves prefix,
  routers match unchanged. SPA fallback `/*` → `/index.html` declared after.

## One-time setup (manual, needs account access)

1. Netlify site from repo. Build: see `netlify.toml` (installs both
   `server/` + `client/`, builds client). Publish `client/dist`.
   Functions `server/functions`, bundler `esbuild` (function lives under
   `server/` so bare imports resolve from `server/node_modules`).
2. Dashboard → Site settings → Build & deploy:
   - **Stop auto-publish from Git** (GitHub Actions `deploy.yml` owns prod).
   - Keep **Deploy Previews ON** for PRs (non-prod env, see below).
   - Node 20 (also in `netlify.toml`).
3. Site settings → Environment variables — **prod** (never commit):
   `MONGODB_URI` (Atlas, allow Netlify egress), `JWT_SECRET`,
   `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`), `STRAVA_CLIENT_ID`,
   `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI=https://<prod>/api/strava/callback`,
   `CLIENT_URL=https://<prod>`, `NODE_ENV=production`.
4. Preview context vars (isolated): separate Atlas DB/user, separate Strava
   app callback `https://deploy-preview-<n>--<site>.netlify.app/api/strava/callback`,
   `CLIENT_URL` = preview origin. Never point previews at prod DB.
5. GitHub repo → Settings → Environments → `production` (required reviewers).
   Secrets: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`. No secret in code/logs.
6. Branch protection `main`: require `CI / validate` green, no bypass.

## Flow

- PR → `ci.yml`: lockfile-strict install, typecheck (server `tsc` + client
  `vue-tsc`, both strict and both blocking), lint + format, `vite build`, server
  unit tests, adapter/factory `node --check`, secret hygiene, and
  `npm audit --audit-level=high` for each workspace.
- Push `main` (+ green CI) → `deploy.yml` (env `production`): rebuild same
  SHA, `nwtgck/actions-netlify@v3` prod deploy with `publish-dir`,
  `functions-dir`, message `prod <sha>`.
- Same SHA rule: checkout `github.sha`, no rebase between CI and deploy.

## Vulnerability exceptions

- Both workspaces: zero high/critical, and CI blocks on
  `npm audit --audit-level=high` for each. The client's 19 advisories (2
  critical, via vitest's tinypool) were cleared by taking the minimum version
  that fixes each one — vite 6, vitest 4, tailwind 4, eslint-plugin-vue 10,
  lint-staged 17 — rather than jumping to the latest of each.

## Verify prod

- `GET https://<prod>/api/health` → `{ok:true}`.
- Authed route, CORS origin allowlist, cookie flags (`Secure`, `Lax`).
- Strava callback URI matches env. Error shape `{error}` no stack/secret.
- Netlify deploy log shows function `api` bundled, commit = `github.sha`.

## Rollback

- App only: Netlify Deploys → last good → Publish deploy (instant, no Git).
- Bad code: `git revert <sha>`, push via PR, CI green, redeploy.
- Env change: dashboard → edit var → redeploy (revert var + redeploy to undo).
- DB migrations: rollback does **not** reverse schema/data. Keep migrations
  backward-compatible, separate from build, approved explicitly. No auto
  migrate per invocation.

## Limits

- Function timeout ~26s default, 512MB-ish. Strava sync per-request OK,
  no WebSocket / local-FS persist / background worker. Rate-limit memory
  store approximate across instances. Mongoose connection cached per warm
  instance (`globalThis.__mongoosePromise`).

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
