# Plan — PWA: installable, offline-tolerant PacePilot

Status: proposed 2026-10-23. No code written yet.

## Outcome

1. PacePilot installs to the home screen on Android/Chrome and iOS Safari and opens standalone.
2. An installed app cold-starts offline: the shell loads, the last successfully read plan/run-day/progress renders, and the screen says it is cached and when.
3. Reconnecting recovers without a manual reload; a rejected session still hard-lands on `/login`.
4. Feedback logged offline is queued and replayed once, not lost and not duplicated.
5. A new deploy offers an update; it never reloads under the athlete mid-form.
6. No new runtime dependency, no `/api/*` response in any cache, no invented data offline.

## Current state

| Already there | Where | Gap |
| --- | --- | --- |
| Manifest, icons 180/192/512, iOS meta, theme color | `client/index.html`, `client/public/` | Manifest has no `id`, `lang`, `purpose: maskable`, `display_override`, `shortcuts`; no screenshots |
| SPA fallback and long-lived asset caching | `server/src/app.ts` static layer | No `sw.js` headers, no `no-cache` on the shell |
| Memory read cache with stale-while-revalidate | `client/src/modules/shared/infrastructure/cache/useResource.ts` | Cache dies on reload; no hydration, no timestamp |
| Feedback already cached in `localStorage` | `client/src/modules/run-day/infrastructure/repository/LocalStorageRunDayRepository.ts` | Submit is network-only: offline loses the write |
| Auth gate re-reads `/strava/status` on every navigation | `client/src/main.ts:47`, `useSession.ts` | Offline → status read fails → redirect to `/login` |
| Network errors reported to Sentry | `client/src/modules/shared/infrastructure/http/client.ts:61` | Every offline request becomes an "our problem" event |
| Inter loaded from Google Fonts | `client/index.html:64-76` | Offline first paint falls back to system sans |
| i18n with `pt` + lazy `en` | `client/src/i18n/` | No keys for offline/install/update copy |

## Locked decisions

- **D1 — no new runtime dependency.** A local Vite plugin emits `sw.js` at build time from a template plus the real asset graph. No `vite-plugin-pwa`/Workbox. Rationale: the repo hand-rolls its bus, cache and dialogs; the SW surface here is three strategies and one message. Revisit if manual precache maintenance outgrows ~150 lines.
- **D2 — precache the shell, never the API.** SW handles GET static assets and navigations only. `/api/*`, non-GET and cross-origin pass straight through. No synthetic responses: offline means cached UI plus a cache timestamp, never a fabricated plan.
- **D3 — persisted reads live in `localStorage`, not CacheStorage.** `useResource` entries for `plan.week`, `progress.summary`, `strava.status`, `account.current` hydrate from a versioned store (`pacepilot.cache.v1:`) with `readAt`; TTL 7 days; cleared on logout, disconnect, account delete and any global 401. CacheStorage stays SW-owned so "clear site data" is the single big hammer.
- **D4 — the offline gate is a marker, not an auth claim.** `session-marker.ts` stores `{ athleteId, verifiedAt }` after a verified `/strava/status` or `/me`. Offline navigation with a marker is allowed; the server still authorises every request, and a 401 online clears the marker and hard-navigates to `/login`.
- **D5 — one feedback outbox, idempotent by date.** Queue entry per local date, cap 20, last write wins. Replay on `online`, on window focus and on app start. The server's unique `(athlete, date)` upsert already makes a replay safe; no endpoint change.
- **D6 — fonts self-hosted** (own workstream, gated): three Inter woff2 weights, latin, `font-display: swap`, precached. Removes the only third-party origin from the shell.
- **D7 — SW only in the production build.** Registration is skipped in dev; `VITE_PWA_ENABLED=false` is the kill switch. Playwright exercises the SW against `vite preview`, not the dev server.

## Non-goals

Push notifications, Web Push/VAPID (no worker infrastructure in the Node service), Background Sync as the only path, share target, periodic background sync, offline login/OAuth, caching Strava streams or activity photos, queueing analytics page views.

## Workstreams

### WS1 — manifest and install assets

1. `client/public/manifest.webmanifest`: add `id: "/"`, `lang: "pt-PT"`, `dir: "ltr"`, `categories: ["health", "fitness", "sports"]`, `display_override: ["standalone", "minimal-ui"]`, `start_url: "/workout?src=pwa"`, `scope: "/"`; icons get `purpose: "any"` and new maskable entries.
2. Generate `icon-192-maskable.png` and `icon-512-maskable.png` (20% safe zone); keep `icon-180.png` for iOS.
3. `shortcuts`: Today `/workout`, Plan `/plan`, Progress `/progress` — each with its own icon.
4. `index.html`: keep existing meta; add `<meta name="color-scheme" content="dark">`. Do not add a second manifest link.
5. Express static layer: manifest `Content-Type: application/manifest+json`, `Cache-Control: public, max-age=3600`; index.html `Cache-Control: no-cache`.

Acceptance: Chrome installability criteria pass (manifest, 192+512, SW, HTTPS); WebKit "Add to Home Screen" opens standalone; shortcuts land on the right route.

### WS2 — service worker and registration

1. New `client/build/pwa-plugin.js`: Vite plugin with `generateBundle` computing the precache list (entry graph, async route chunks, CSS, icons, fonts, manifest), hashing it into `VERSION`, and emitting `sw.js` from `client/src/pwa/sw.template.js`.
2. `client/src/pwa/register.ts`: register on `load` when `import.meta.env.PROD && VITE_PWA_ENABLED !== 'false'`; failures go through `recordRecoveredError`, never throw.
3. `client/src/main.ts`: call `registerServiceWorker()` after mount, next to the Sentry setup.
4. SW strategies:
   - navigation: network-first with a 3 s timeout, fall back to cached `index.html`;
   - `/assets/*` and precached files: cache-first, `cache.addAll` at install;
   - everything else: `event.respondWith(fetch(event.request))` or no handler at all — `/api/*` must be absent from every cache;
   - `activate`: delete caches outside the current allowlist; `message: { type: 'SKIP_WAITING' }`.
5. Express static layer: `sw.js` → `Cache-Control: no-cache`, `Service-Worker-Allowed: /`.
6. `client/scripts/check-pwa.mjs`, run after `build`: `dist/sw.js` exists, precache list covers every `dist/assets/*.js`, no `/api/` string in the SW.

Acceptance: `npm run build` emits `dist/sw.js`; offline reload of `/plan` returns the shell; `caches.keys()` + `cache.keys()` contain no API URL; no SW in `npm run dev`.

### WS3 — update flow

1. `client/src/modules/shared/infrastructure/pwa/usePwaUpdate.ts`: `waiting`, `apply()`, listens for `updatefound`/`controllerchange`, checks on `visibilitychange` at most once per 30 minutes.
2. `client/src/components/ui/AppUpdateBanner.vue`: `role="status"`, "Nova versão disponível", `Later` / `Reload`; mounted once in `App.vue` outside both layouts.
3. New keys in `pt.json` and `en.json` (`pwa.update.*`). No timer-driven reload; the athlete chooses.
4. `BroadcastChannel` (or a storage flag) so two open tabs prompt once.

Acceptance: a second build with a `waiting` worker shows the banner; clicking Reload applies it once with no reload loop; dismissing keeps the old worker until the next session.

### WS4 — offline shell and session marker

1. `client/src/modules/shared/infrastructure/pwa/useOnline.ts`: shared `online` ref from `online`/`offline` listeners, one registration for the app, no per-component listener leak.
2. `client/src/modules/shared/infrastructure/pwa/session-marker.ts`: read/write/clear with try/catch, `verifiedAt` ISO string, versioned key. Written in `useSession.checkStatus()` on success and by `useCurrentUser`; cleared on logout, disconnect, delete and 401.
3. `client/src/main.ts` guard: `if (!to.meta.public && !online && hasMarker()) return true`; otherwise current behaviour. On regaining connectivity, revalidate once; a 401 clears the marker and replaces to `/login`.
4. `client/src/components/ui/OfflineBanner.vue`: `aria-live="polite"`, "Sem ligação — a mostrar dados de {time}". Placed in `App.vue` above `<main>`; never colour-only.
5. `http/client.ts`: skip `captureException` when `navigator.onLine === false` (offline is expected); keep the classification for timeouts while online.

Acceptance: cold start offline at `/plan` stays on `/plan` with cached content and the banner; no redirect loop; reconnect refreshes; logout offline clears the marker and the persisted reads.

### WS5 — persisted reads and cache timestamp

1. `client/src/modules/shared/infrastructure/cache/persisted-store.ts`: port + `localStorage` adapter, key prefix `pacepilot.cache.v1:`, `{ schema, readAt, value }`, safe parse, quota failure swallowed and reported once.
2. `useResource`: on `entryFor(key)`, hydrate synchronously from the store when the key is in the persisted allowlist; write on success; expose `readAt` on `Resource`. Keep `useResource` framework-free of the adapter by injecting a store at module init, so tests can pass a fake.
3. Persisted keys: `plan.week`, `progress.summary`, `strava.status`, `account.current`. `plan.today` and activities pages stay memory-only (smallest useful set; list payloads are large).
4. Views show "Atualizado às HH:MM" only when offline/served-from-cache; no new visual language, reuse `caption`/`faint` tokens.
5. Global 401 interceptor in `http/client.ts` clears the persisted store and the session marker, then lets the router guard redirect.

Acceptance: hard reload with no network still renders the last plan and progress; TTL expiry drops the value; logout leaves no `pacepilot.cache.v1:` keys.

### WS6 — offline feedback outbox

1. New bounded context `client/src/modules/feedback-outbox/` in the house layout: `domain/entity/FeedbackOutbox.ts` (one entry per local date, cap 20, `enqueuedAt`, `attempts`), `domain/repository/` port, `application/use-case/EnqueueFeedback.ts`, `FlushFeedbackOutbox.ts`, `domain/event/FeedbackQueued.ts`, `FeedbackFlushed.ts`.
2. `infrastructure/repository/LocalStorageFeedbackOutboxRepository.ts`: versioned key, `BroadcastChannel('pacepilot.outbox')` for tab coordination, no network.
3. `SubmitRunDayFeedback` (run-day) catches a network-class failure, enqueues, returns a `queued` outcome; the view keeps the locked/complete state and toasts "Guardado. Será enviado quando houver ligação."
4. `FlushFeedbackOutbox`: on `online`, focus and boot; sends in `enqueuedAt` order; removes only on 2xx; stops on 401 (session) and on 4xx (bad payload, keeps the entry and surfaces it); a flush lock with a stale-lock timeout prevents duplicate sends across tabs.
5. `useOutbox` projects `pending` count; `OfflineBanner` reads it. i18n keys in both catalogues.

Acceptance: offline submit survives a reload; reconnect sends exactly one POST per date; two tabs do not double-send; a 4xx keeps the entry and shows a recoverable error.

### WS7 — self-host Inter (gated, D6)

1. Add `client/public/fonts/inter-{400,600,800}-latin.woff2`; `@font-face` with `font-display: swap` in `client/src/assets/styles.css`; delete the two preconnects and the stylesheet link from `index.html`.
2. Add the three files to the precache list; `font-sans` already names Inter.
3. `prefers-reduced-motion` and type scale untouched.

Acceptance: no request to `fonts.googleapis.com`/`fonts.gstatic.com`; offline first paint keeps Inter; no CLS regression.

### WS8 — observability, tests, CI, docs

1. Analytics: keep dropping page views offline (documented non-goal), but do not count the offline guard as a session check.
2. Unit (Vitest, `client/src/**/__tests__`): persisted-store hydration/expiry/schema-mismatch/quota, outbox entity and flush use case (ports fake the transport), session marker, SW precache list sanity in `check-pwa.mjs`.
3. Playwright: `client/tests/e2e/pwa.spec.ts` + `client/playwright.pwa.config.ts` against `npm run build && npm run preview` (port 4173). Cases: manifest fields, SW controls the page, offline reload renders the shell, offline Today shows cached data + banner, no API cache entries, install banner copy has no a11y violations (axe).
4. Fake the network with `context.setOffline(true)`; never assert on `navigator.serviceWorker` in dev.
5. CI `ci.yml`: after `npm run build`, run `check-pwa.mjs`; add the Playwright PWA job as a separate non-blocking step until it is stable for two weeks, then make it blocking.
6. Docs: PWA section in `docs/deployment.md` — headers, kill switch (`VITE_PWA_ENABLED=false` plus a one-off `sw.js` that unregisters and clears caches), rollback; README scripts. Link this plan from `CLAUDE.md` "Where to read more".

Acceptance: unit + PWA e2e green locally; CI build proves the SW matches the bundle; rollback procedure rehearsed on a preview deploy.

## Contracts preserved

| Invariant | Effect of this plan |
| --- | --- |
| Engine decides, model explains | Untouched: the SW caches responses, it never authors one |
| Never invent activity data | Offline shows only previously returned values with a timestamp; API stays pass-through, no synthetic JSON |
| Dates are local | Outbox keys reuse `LocalDateKey`, never UTC |
| httpOnly cookie JWT | SW never reads or stores cookies; CacheStorage holds no API body |
| Data routes 503 without Mongo | Unchanged; the SW does not mask 503 as success |
| Response shapes | Unchanged; no server endpoint added for the outbox |
| 500 kB chunk budget | `sw.js` is emitted separately at the dist root, not in `assets/`; check script stays as is |

## Verification

```bash
npm run typecheck --prefix client
npm run lint --prefix client
npm run format:check --prefix client
npm test --prefix client
npm run build --prefix client            # now also check-pwa.mjs
npx playwright test --config client/playwright.pwa.config.ts
npm test --prefix server                 # only if WS6 touches a server contract (it should not)
```

Manual: install on Android Chrome and iOS Safari; airplane-mode cold start; two-tab update; offline feedback then reconnect; logout clears storage (`localStorage`, `caches`).

## Risks and mitigations

- **Stale shell after deploy** — hashed assets + network-first navigation + `no-cache` on `index.html`/`sw.js`; the SW deletes unknown caches on activate.
- **iOS storage eviction** — Safari may clear site data after ~7 days of non-use. The persisted cache is a convenience, never the source of truth; the offline gate must degrade to `/login` without a marker.
- **Old SW reporting into a new release** — `VERSION` is embedded in `sw.js` and sent as a Sentry tag; the update banner makes the stale window explicit.
- **Private data on a shared device** — persisted keys are cleared on logout/disconnect/delete and on any 401; add a "Clear cached data" action in Settings next to disconnect.
- **SW scope vs `/api`** — a navigation handler that matches `/api/*` would return HTML to fetch; the handler filters on `request.mode === 'navigate'` and on the `/api/` prefix.
- **Double feedback send** — one entry per date, a `flush` lock with stale timeout, server-side unique upsert. If a 2xx is lost, the replay overwrites the same row instead of appending.
- **Bundle/CI drift** — `check-pwa.mjs` fails the build when the precache list misses a built chunk, which is the usual hand-rolled-SW failure.
- **Sentry noise** — offline suppression in the HTTP interceptor; keep reporting genuine 5xx while online.
- **Analytics gaps** — offline page views are lost. Accepted; document it rather than adding a second queue.

## Sequencing

| Order | Workstream | Est. |
| --- | --- | --- |
| 1 | WS1 manifest/icons | 0.5 d |
| 2 | WS2 SW + registration + check script | 1.5 d |
| 3 | WS3 update flow | 0.5 d |
| 4 | WS4 offline gate + banner | 0.5 d |
| 5 | WS5 persisted reads | 1 d |
| 6 | WS6 outbox | 1.5 d |
| 7 | WS7 fonts | 0.5 d |
| 8 | WS8 tests/CI/docs | 1 d |

WS1–WS4 make it a correct installable PWA (MVP). WS5–WS6 make it useful offline. WS7 is polish. Ship WS1–WS4 first; WS5+ behind `VITE_PWA_ENABLED` if needed.

## Decision needed before WS2

D1 recommends the local plugin. Approve that, and confirm whether WS6 (offline feedback) and WS7 (self-hosted fonts) are in the first release or deferred.
