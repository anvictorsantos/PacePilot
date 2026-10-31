# Plan — provider-agnostic activity sources (Strava first, Garmin-ready)

Status: implemented through WS7; WS8 (Garmin adapter) pending partner credentials
Scope: `server/src/modules/{strava,activities,athlete,training,progress,waitlist,shared}/**`,
`server/src/app.ts`, `server/scripts/**`, `client/src/modules/{strava,activities,run-day,progress,shared,analytics}/**`,
`client/src/features/{auth,landing,settings,activities}/**`, `client/src/layouts/**`,
`client/src/i18n/{pt,en}.json`, `CLAUDE.md`, `CONTEXT.md`, `README.md`

## Implementation log (2026-10-24)

- WS0–WS3: `modules/providers/` (Provider, capabilities, canonical activity,
  `ActivityProvider` port, typed errors), Strava adapter with its sport/stream/
  laps/trophy mapping, `Connection` persistence, `connection.service` and
  `activity-import.service`, dual-read/dual-write of the legacy athlete columns.
- WS4: `/api/providers/*` mounted; `/api/strava/*` forwards to the same router.
  Capacity counts connections against `ATHLETE_LIMIT` (legacy env fallback).
- WS5–WS6: client `modules/connections` with provider-neutral ports/DTOs,
  `useConnection`, `useProviderConnect`, `useProviders`, `provider-brand.ts`;
  canonical zones cached on `Athlete.hr_zones`; `target_hr_source` is `'device'`.
- WS7: `GET /api/activities/:id` resolves an opaque document id first, then a
  provider id, then a legacy numeric Strava id. Client DTOs read `id` /
  `provider_activity_id`, never `strava_activity_id`.
- Migration: `npm run db:migrate-providers` (`-- --dry-run` supported).
- WS8 is intentionally not implemented: Garmin's OAuth/Health API requires a
  partner grant, and inventing endpoints would be worse than leaving the seam
  empty. `capabilities.webhook` and the shared `persistActivities` writer are the
  prepared entry points.

## Outcome

Strava becomes the first implementation of an **activity source** rather than the
only one. The training engine, the plan, progress, feedback and every screen keep
their rules and vocabulary; only the evidence layer changes shape. Adding Garmin
later is: one adapter folder, one registry entry, one env block, one brand entry —
with **no edits** under `modules/training`, `modules/progress`,
`modules/plan*` or `modules/ai`.

### Acceptance criteria

- Every current Strava flow behaves identically: authorize → callback → session,
  status, pull sync, activity detail enrichment, logout, disconnect.
- `grep -ri strava server/src/modules/{training,progress,ai,activities/domain}` returns
  **zero** hits; `activities/application` hits only the provider-neutral ingestion
  pipeline.
- A test provider (`fake`) can authorize, pull, ingest and disappear from the UI
  with no product-code change outside `modules/providers` and the brand map.
- One athlete can hold several connection rows; v1 activates one source at a time
  and ingests only that source. The schema does not need to change to add the
  second.
- Existing wire responses stay compatible through the migration (see
  §Contracts preserved). No screen loss: `id`, `last_synced_at`, `connected`,
  `target_hr_source` all still resolve.
- Tokens stay encrypted at rest, never logged, never sent to the client; identity
  still comes only from the verified session.
- All checks in §Verification pass.

## Absorbed current state (what actually exists)

### Server flow

| Step | Today | Location |
| --- | --- | --- |
| Authorize | Builds Strava URL with env client id, scope `read,activity:read,profile:read_all`, CSRF `state` cookie, `next` cookie, mobile endpoint switch | `strava.routes.ts` `/authorize`, `strava.service.ts` `getAuthorizeUrl` |
| Callback | Exchanges code, checks athlete cap, upserts `Athlete` with **tokens + profile + Strava id**, mints JWT (`athleteId`, `stravaId`, `tv`) | `strava.routes.ts` `/callback` |
| Status | True only when the row still has `access_token`; DB-down still answers | `strava.routes.ts` `/status` |
| Profile | `GET /athlete`, caches `badge_type_id` / `badges` on the athlete | `strava.routes.ts` `/athlete` |
| Sync | Throttle window (15 min), incremental `after` with 14-day overlap, pages of 50, max 500/sync, one bulkWrite, HR zones best-effort, `last_synced_at` | `strava.routes.ts` `/sync` (business logic in the route) |
| Enrichment | Detail read fetches laps + streams + trophies lazily, `detail_version = 2`, never fails the read | `activities.routes.ts` `GET /:id` |
| Disconnect | Revokes at Strava, unsets tokens, sets `disconnected_at`, bumps `tokenVersion`, frees slot | `strava.routes.ts` `/disconnect` |
| Logout | Clears cookie + bumps `tokenVersion`, keeps the Strava grant/slot | `strava.routes.ts` `/logout` |

### Data shape today

- `Athlete` (`athlete/infrastructure/persistence/Athlete.ts`) mixes **identity**
  (`firstname`, `lastname`, `profile`, `timezone`, `goal`, `goalSetAt`) with
  **connection state**: `strava_athlete_id`, `access_token`, `refresh_token`,
  `expires_at`, `scopes`, `zones`, `badge_type_id`, `badges`, `last_synced_at`,
  `disconnected_at`, `tokenVersion`.
- `Activity` (`activities/infrastructure/persistence/Activity.ts`) keys on
  `strava_activity_id` (unique, sparse) and stores Strava's `sport_type` verbatim;
  `raw` holds the provider payload.
- `target_hr_source` is either `'strava'` or `'estimate'`
  (`training/application/plan.service.ts`).
- Capacity counts `CONNECTED_ATHLETE_FILTER` (athlete with a live grant) against
  `STRAVA_ATHLETE_LIMIT`.

### Client flow

- `modules/strava/` owns: `useSession` (reads `/strava/status`, one per page),
  `useAutoSync` (15-minute stale window), `SyncActivities` use case (in-flight
  dedupe, cache invalidation, toast), `StravaSyncApiRepository`,
  `ResourceCacheInvalidator`, `ToastStravaSyncNotifier`, DTOs `StravaStatus` /
  `SyncResult`.
- `shared/infrastructure/http/client.ts` has the `strava` route group and the
  `/strava/*` path registry.
- Login/landing/settings hardcode `/api/strava/authorize` and the `StravaIcon`;
  `UserMenu` prints `strava.status.connected`; `NotificationCenter` calls the
  strava module; `ActivityCard`, `ActivitiesView`, `run-day`, `progress` fall back
  on `strava_activity_id`; analytics emits `StravaConnect`; `RESOURCE_KEYS.stravaStatus`
  is `'strava.status'`; CSP allows the Strava avatar CDN.

### Coupling inventory

| File | Strava-specific | Target |
| --- | --- | --- |
| `strava/application/strava.service.ts` | Transport + OAuth + token refresh **and persistence** + Strava paths/params + `StravaRateLimitError` | Split: `providers/strava/{oauth,api,map-*}.ts`; token persistence moves to `connection.service` |
| `strava/infrastructure/routes/strava.routes.ts` | OAuth, cap, sync loop, bulk writes, zones, status | Thin HTTP edge over `connection.service` + `activity-import.service` |
| `athlete/.../Athlete.ts` | Tokens, zones, Strava id, sync watermark | Identity only; connection state moves to `Connection` |
| `athlete/application/session.service.ts` | `stravaId` fallback, strips Strava token fields | `athleteId` only; no provider in identity |
| `activities/application/activity.service.ts` | `StravaActivityPayload`, Strava laps/streams/trophy shapes, Strava sport names | Canonical input; Strava translation lives in the adapter |
| `activities/domain/value-object/SportType.ts` | The 56-value Strava table | Canonical `Sport` + provider mapping tables |
| `activities/.../Activity.ts` | `strava_activity_id` unique index | `{ provider, provider_activity_id }` compound unique |
| `activities/.../activities.routes.ts` | Imports Strava service for enrichment, numeric id lookup | Provider registry + capability-gated enrichment, opaque id |
| `progress/application/build-progress.ts` | `strava_activity_id` in `records[].id` | `id` only |
| `training/domain/targets.ts` + `plan.service.ts` | Strava zone payload, `'strava'` source | Canonical zones; `'device'` source |
| `waitlist/.../routes.ts` | `STRAVA_ATHLETE_LIMIT`, grant count | `ATHLETE_LIMIT`, connection count |
| `app.ts` | `/api/strava`, Strava CDN in CSP, limiter path | `/api/providers`, provider CSP origins from the registry |
| `client/src/modules/strava/**` | Folder, port names, DTOs, resource key | `modules/connections/` + neutral DTOs |
| client views/layouts | Hardcoded URL + icon + copy | Provider metadata from `GET /api/providers`, brand map |

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | One port, `ActivityProvider`, and one anti-corruption layer per provider. Adapters return **our** canonical shapes, never provider payloads. | The engine must never see a provider's wire format. Mirrors the existing `openrouter-client` isolation. |
| D2 | Connection state lives in a separate `Connection` collection keyed `{ athlete, provider }`; `Athlete` keeps identity + goal only. | Tokens, scopes, zones and watermarks are per source, not per person. |
| D3 | Provider ingestion returns `CanonicalActivity` / `CanonicalStreams` / `CanonicalZones`; normalization, classification and persistence stay in `modules/activities`. | Business rules stay where they are; only the boundary moves. |
| D4 | Ingestion has two entry points, `pull(connection)` and `ingest(connection, envelopes)`, writing through the same pipeline. Capability flags say which is available. | Garmin Health is push-first; a pull-only design would force a rewrite. |
| D5 | Generic routes `/api/providers/*`; `/api/strava/*` stays as an alias for one release. | No flag day; the client migrates on its own schedule. |
| D6 | Provider metadata (`id`, label key, auth kind, capabilities, brand) is served by `GET /api/providers`, not hardcoded in views. | UI, CSP and sync affordances become data-driven. |
| D7 | v1: several connection rows possible, one **active** evidence source per athlete. No account merging across providers. | Avoids an identity model change; dedupe by `{provider, external id}` prevents collisions. |
| D8 | `Activity.id` becomes the opaque Mongo `_id`; `provider` + `provider_activity_id` are separate fields; legacy numeric URLs keep resolving for one release. | Two providers can reuse numeric ids; URLs must stay unambiguous. |

## Target architecture

```text
server/src/modules/providers/
  domain/
    provider.ts                 Provider const object + type ('strava' | 'garmin' | ...)
    capability.ts               ProviderCapabilities (pull, webhook, streams, laps, segments, zones, profile)
    connection.ts               ProviderConnection entity: token expiry, disconnect, scope check
    provider-activity.ts        CanonicalActivity, CanonicalLap, CanonicalStreams, CanonicalZones, CanonicalAthlete
    ports/activity-provider.ts  the ActivityProvider port
    errors.ts                   ProviderRateLimitError, ProviderAuthError, ProviderUnavailableError
  application/
    connection.service.ts       OAuth code exchange, upsert, refresh, revoke, status, capacity
    activity-import.service.ts  throttle, watermark/overlap, pages, normalize, classify, bulk upsert, cache invalidation
    provider-registry.service.ts  enabled providers, lookup by id, metadata for the client
  infrastructure/
    providers/strava/           oauth.ts, api.ts, map-activity.ts, map-streams.ts, map-zones.ts, sport-types.ts, index.ts
    providers/garmin/           (phase 8 spike) same shape + webhook.ts
    persistence/Connection.ts   mongoose model
    routes/providers.routes.ts  /api/providers/*
    routes/legacy-strava.routes.ts  thin forwarding alias
  index.ts                      registerProviders()
```

```text
client/src/modules/connections/
  domain/repository/provider-sync.repository.ts     (was strava-sync.repository)
  domain/repository/imported-activities-cache.repository.ts
  domain/service/provider-sync-notifier.ts          (was strava-sync-notifier)
  application/use-case/SyncActivities.ts            (unchanged behaviour)
  infrastructure/repository/ProviderSyncApiRepository.ts
  infrastructure/composable/useConnection.ts        (was useSession)
  infrastructure/composable/useAutoSync.ts
  infrastructure/container/connections-container.ts
  infrastructure/dto/ConnectionStatus.ts, ProviderDescriptor.ts, SyncResult.ts
  infrastructure/notification/ToastProviderSyncNotifier.ts
  infrastructure/cache/ResourceCacheInvalidator.ts
```

Provider presentation is **not** a domain concern:

```text
client/src/modules/shared/ui/provider-brand.ts   label key, icon component, brand token, docs link
client/src/components/icons/StravaIcon.vue       (existing)
client/src/components/icons/GarminIcon.vue       (later)
```

## Canonical contracts

### `ActivityProvider`

```ts
export interface ActivityProvider {
  readonly id: Provider
  readonly capabilities: ProviderCapabilities

  authorizeUrl(state: string, opts: { mobile?: boolean }): string
  exchangeCode(code: string): Promise<ProviderTokens>              // access, refresh?, expiresAt, scopes, externalAthleteId, profile?
  refresh(refreshToken: string): Promise<ProviderTokens>
  revoke(tokens: ProviderTokens): Promise<void>

  listActivities(conn: ProviderConnection, q: ActivityQuery): Promise<CanonicalActivityPage>
  getActivity(conn: ProviderConnection, externalId: string): Promise<CanonicalActivity | null>
  getStreams?(conn: ProviderConnection, externalId: string): Promise<CanonicalStreams | null>
  getZones?(conn: ProviderConnection): Promise<CanonicalZones | null>
  getProfile?(conn: ProviderConnection): Promise<CanonicalAthlete | null>

  /** Push providers (Garmin) implement this; the route verifies and ingests. */
  parseWebhook?(req: ProviderWebhookRequest): Promise<CanonicalActivityEnvelope[]>
  verifyWebhook?(req: ProviderWebhookRequest): boolean
}
```

`ActivityQuery` is `{ after?: Date; before?: Date; cursor?: string; page?: number; perPage?: number }`
— `after`/`before` are **Dates**, adapters convert to their epoch convention. The
application layer never sends `after_epoch_seconds` or `per_page`.

### `CanonicalActivity`

All fields optional except `externalId` and `startedAt`; units are SI and named
with the unit so a provider cannot silently switch units.

```ts
interface CanonicalActivity {
  externalId: string
  startedAt: Date
  rawSport: string                  // trace only: provider's own label
  sport: Sport                      // canonical family mapping input
  distanceM?: number
  movingTimeS?: number
  elapsedTimeS?: number
  avgSpeedMps?: number | null
  maxSpeedMps?: number | null
  elevationM?: number
  avgHr?: number | null
  maxHr?: number | null
  avgCadenceSpm?: number | null
  hasHr?: boolean
  calories?: number | null
  achievementCount?: number
  prCount?: number
  laps?: CanonicalLap[]
  trophies?: Trophy[]
  streams?: CanonicalStreams
  raw: unknown                      // stored trimmed, never sent to the client
}
```

`Sport` is a canonical const object (`run`, `trail_run`, `treadmill_run`, `ride`,
`swim`, `strength`, `hiit`, `mobility`, `other`) plus one mapping table per
provider in its adapter. `ActivityKind` remains the training family and is
derived from `Sport` in the domain — no provider table at that layer.

### Connection persistence

```ts
{
  athlete: ObjectId,                 // identity
  provider: 'strava' | 'garmin',
  externalAthleteId: string,
  displayName?: string,
  avatarUrl?: string,
  accessToken: string,               // encrypted via tokenCrypto
  refreshToken?: string,             // encrypted
  expiresAt?: Date,
  scopes: string[],
  zones?: CanonicalZones,            // [{ min, max }] bpm
  badgeSnapshot?: unknown,           // provider-specific badge cache, opaque
  lastSyncedAt?: Date,
  syncCursor?: string,
  disconnectedAt?: Date | null,
  lastSyncError?: { code: string; at: Date } | null,
  createdAt, updatedAt
}
```

Indexes: unique `{ athlete: 1, provider: 1 }`, `{ provider: 1, disconnectedAt: 1 }`,
and `{ provider: 1, externalAthleteId: 1 }` unique where a provider id must not
bind to two athletes.

### Wire additions (no removals in phase 1–5)

- `GET /api/activities` items gain `provider`, `provider_activity_id`; `id` stays
  present.
- `GET /api/providers` → `{ providers: [{ id, authKind, capabilities, enabled }] }`.
- `GET /api/providers/status` → `{ connected, provider, last_synced_at, connections: [...] }`
  (or `GET /api/providers/:provider/status` kept for symmetry).
- `POST /api/providers/:provider/sync` → current `SyncResult` shape.
- `GET /api/providers/:provider/callback` → same redirects and cookies.
- `POST /api/providers/:provider/disconnect`, `POST /api/session/logout`.

## Workstreams

### WS0 — pin the contracts (no behaviour change)

- Add `providers/domain/{provider,capability,provider-activity,errors}.ts` and the
  port. No implementation, no route.
- Add `server/tests/unit/provider-contract.test.ts` as a **table-driven contract
  suite** every adapter must pass (`PROVIDERS_UNDER_TEST`), and fixture folders
  `tests/fixtures/{strava,garmin}/...` (list page, detailed activity, streams,
  zones, malformed payload).
- Acceptance: types compile; contract test is skipped until an adapter registers.

### WS1 — extract the import pipeline from the route (still Strava)

- Move the `/sync` body into `application/activity-import.service.ts` with an
  explicit interface: `importActivities({ athleteId, connection, mode: 'pull', force })`.
- Keep the throttle, 14-day overlap, page cap, bulkWrite chunking, `guarded`
  response and `clearAiCacheForAthlete` exactly as today.
- Move `strava.service.ts` under `providers/strava/` and make it implement
  `ActivityProvider` (transport + mapping), while token persistence moves to
  `connection.service`.
- `strava.routes.ts` becomes an HTTP edge only (auth, status codes, JSON).
- Acceptance: `/api/strava/*` unchanged; existing `activity.service` tests pass;
  new tests cover throttle, pagination cap, partial rate-limit response.

### WS2 — canonical activity boundary

- Add `map-activity.ts` / `map-streams.ts` in the Strava adapter; move
  `StravaActivityPayload`, laps/streams/trophies translation and the `SPORT_KINDS`
  table there.
- `activities/application/activity.service.ts` consumes `CanonicalActivity`:
  `normalizeActivity(canonical)`, `normalizeLaps` / `normalizeStreams` operate on
  canonical shapes; classification is untouched.
- Persist `provider: 'strava'` and `provider_activity_id: String(raw.id)` on every
  write; keep `strava_activity_id` dual-written.
- Add compound unique index `{ provider: 1, provider_activity_id: 1 }`; keep the
  old unique index until WS7.
- Acceptance: re-sync is idempotent; contract test passes for Strava fixtures;
  classification fixtures unchanged.

### WS3 — connection persistence + migration

- Add `Connection` model and `connection.service` (exchange, refresh, revoke,
  upsert, status, capacity).
- Dual-read: `getConnection(athleteId, provider)` falls back to the legacy
  `Athlete` token fields; dual-write: callback writes both models.
- `server/scripts/migrate-provider-connections.mjs` (idempotent, dry-run flag):
  1. Athlete with tokens → upsert `Connection` (encrypted tokens copied as-is,
     `zones` translated to `CanonicalZones`, `lastSyncedAt`, `disconnectedAt`).
  2. Activity without `provider` → set `provider: 'strava'`,
     `provider_activity_id = String(strava_activity_id)`.
  3. Report counts; create new index; leave old fields and index in place.
- Session strips no token fields any more (they are gone); `stravaId` kept only
  for legacy JWT lookup, marked deprecated.
- Acceptance: migration is rerunnable with zero writes on the second pass; a
  disconnect leaves the `Connection` row with `disconnectedAt` and no tokens.

### WS4 — generic HTTP surface

- Mount `/api/providers` before the legacy alias. Handlers resolve the provider
  via the registry and reject unknown/disabled ones with 404/403 consistently.
- OAuth state is namespaced per provider (`oauth_state_<provider>`), and the
  callback rejects a provider/cookie mismatch.
- Rate limiters move to `/api/providers/:provider/sync` (keep the legacy path
  limited too). `GET /api/providers/status` stays public and answers without a DB.
- `/api/strava/*` alias forwards to the same handlers and is removed in the
  release after the client ships WS5.
- Capacity counts `Connection` rows `{ disconnectedAt: null }` against
  `ATHLETE_LIMIT` (fall back to `STRAVA_ATHLETE_LIMIT` for one release).
- CSP `imgSrc` is derived from the enabled providers' declared asset origins.
- Acceptance: endpoint-by-endpoint parity test against the legacy routes; 503
  without DB on data routes; `/api/providers/status` answers with no DB.

### WS5 — client becomes provider-aware

- Rename `modules/strava/` → `modules/connections/`; rename ports/DTOs/composables
  to neutral names (`useConnection`, `ConnectionStatus`, `ProviderSyncRepository`).
  Keep the use case behaviour (in-flight dedupe, guarded silence, cache
  invalidation, toast classification) unchanged.
- `useConnection` reads `GET /api/providers/status`; `RESOURCE_KEYS.connectionStatus`
  replaces `strava.status`.
- Add `useProviders` reading `GET /api/providers`; login, landing and settings
  render one action per enabled provider through `provider-brand.ts`. Strava stays
  the only rendered entry with `PROVIDERS_ENABLED=strava`.
- `api.providers.*` replaces `api.strava.*`; the old group is deleted in the same
  release after all consumers move.
- `UserMenu` copy becomes `connections.status.connected` with `{provider}`;
  `NotificationCenter` calls the new container.
- Acceptance: login with Strava is pixel- and behaviour-identical; sync button,
  auto-sync and disconnect still work; `/api/providers/status` failure degrades to
  the same logged-out state as today.

### WS6 — canonical zones and HR source

- Store `CanonicalZones` on `Connection`; Strava adapter translates
  `Athlete.zones` (`heart_rate.zones` or the array form) → `{ min, max }[]`.
- `targetHr` reads canonical zones only; `target_hr_source` becomes `'device'`
  when zones exist. Client `training-vocabulary.ts` maps `'device'` and keeps
  accepting `'strava'` during the transition.
- Acceptance: `GET /api/plan/today` and `/week` return the same target strings for
  a migrated athlete; both `'device'` and legacy `'strava'` render correctly.

### WS7 — opaque activity ids, drop Strava reads

- `sanitizeActivity` returns `id: String(_id)` plus `provider` and
  `provider_activity_id`; detail route resolves ObjectId first, then legacy
  numeric `strava_activity_id`, then `{ provider_activity_id, athlete }`.
- Client uses `activity.id` only (`ActivityCard`, `ActivitiesView`,
  `RefreshRunDay`, `useRunDay`, progress records). Remove `strava_activity_id`
  fallbacks from DTOs.
- Keep dual-write for one release, then stop writing `strava_activity_id` and drop
  the old unique index in a follow-up migration.
- Acceptance: old activity links still open; new links work; no client code reads
  `strava_activity_id`.

### WS8 — Garmin spike (proves the seam)

- Implement `providers/garmin/`: OAuth flow, `map-activity`, `map-streams`,
  `map-zones`, `parseWebhook` + signature verification, capabilities
  `{ pull: false, webhook: true, streams: true, laps: true, segments: false }` as
  the actual integration allows.
- Add `POST /api/providers/garmin/webhook` (mounted only when enabled) calling the
  same `ingest` path with idempotent envelopes and replay protection.
- UI hides the sync button when `capabilities.pull === false` and shows
  "Connected — activities arrive automatically".
- Acceptance: the fake-provider integration test and the Garmin fixtures pass;
  no file under `modules/training`, `modules/progress` or `modules/ai` is touched.

## Sequencing

```text
WS0 → WS1 → WS2 → WS3 → WS4 → WS5 → WS6 → WS7 → WS8
```

Rules: WS1 and WS2 ship before any route renaming; WS3 ships before WS5 so the
client never talks to a generic route backed by a half-migrated model; WS7 lands
only after the client no longer reads the legacy field; WS8 is allowed to change
only `modules/providers/**`, the brand map, i18n brand keys and docs.

## Contracts preserved

| Contract | Guarantee |
| --- | --- |
| `GET /api/strava/status` | Same body `{ connected, last_synced_at }`, 200 without DB |
| `POST /api/strava/sync` | Same `SyncResult` incl. `guarded`, `truncated`, `zones` |
| `GET /api/activities`, `/:id` | Existing fields kept; additions only; ownership 404 preserved |
| `GET /api/plan/*`, `/progress`, `/goals` | Unchanged shapes; `target_hr_source` gains `'device'`, `'strava'` still accepted |
| Auth | httpOnly cookie JWT, `tokenVersion` revocation, same-origin write guard unchanged |
| Tokens | Encrypted at rest, never in a response, redacted from logs |
| No database | `/api/health` and provider status answer; data routes 503 |
| Engine | Provider supplies evidence only; no model or adapter picks a workout |

## Verification

Per workstream, and as the final gate:

- `npm run typecheck --prefix server`, `npm test --prefix server`
- `npm run typecheck --prefix client`, `npm run lint --prefix client`,
  `npm run format:check --prefix client`, `npm test --prefix client`,
  `npm run build --prefix client` (chunk budget still enforced)
- `npx playwright test` (login + a11y; the login action must be keyboard-reachable
  and named for the active provider)
- Server boot smoke: `node --import ./scripts/register-alias.mjs src/index.ts`
  with `PORT`, `JWT_SECRET`, then `curl /api/health` and `/api/providers/status`
- Render build smoke: `render.yaml` installs, builds `client/dist` and typechecks
  the server; the boot smoke above proves the same process serves `/api`.
- Migration dry run and rerun on a copy of a real document set; count parity for
  athletes ↔ connections and activities ↔ provider ids
- `grep -RnE 'style="|z-\[|text-\[#|bg-\[#' client/src --include='*.vue'` for the
  touched views (unchanged expectation: dynamic bindings only)
- Final agnosticism grep: no provider name outside
  `modules/providers/**`, migrations, brand map, i18n brand label, docs

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Token migration loses/duplicates a grant | Idempotent upsert keyed `{athlete, provider}`; dry run + count report; tokens copied ciphertext, never decrypted in the script |
| Old numeric URLs break | Detail route keeps the numeric fallback for one release; client switches to opaque `id` in WS7 |
| Duplicate activities during dual-write | Compound unique index added before the first dual-write sync; sync stays upsert-only |
| Pull-only assumptions block Garmin | WS0 defines `capabilities` and `ingest`; WS1 never exposes provider paging params to the application |
| OAuth state collision across providers | Namespaced state cookie + provider/cookie match check |
| Capacity semantics change | `ATHLETE_LIMIT` reads the legacy var as fallback; count moves from athlete grant to connection row atomically with the status read |
| `target_hr_source` change breaks the client vocabulary | Both values accepted in `training-vocabulary.ts` for one release; response shape unchanged |
| Strava brand/attribution rules | Brand stays in `provider-brand.ts` and the provider's i18n label; no generic "Strava" copy in neutral screens; Strava API terms reviewed before launch of another provider |
| Provider-specific asset origins blocked by CSP | CSP image origins come from the enabled provider descriptors, not a hardcoded list |
| Rate limits are per provider | Error type carries `provider` + `retryAfter`; limiter stays per IP and per route; sync throttle stays per connection |

## Non-goals (v1)

- Merging one person's Strava and Garmin accounts into one identity. No
  cross-provider account linking; a second connection is possible in the schema,
  not in the product.
- A provider marketplace, provider settings screens, or per-provider plans.
- Replacing the deterministic engine, the plan contract or the AI explain layer.
- Streaming/webhook UI beyond connection status.
- Normalising segment/trophy semantics across providers: `trophies` remains
  `[]` for a provider that does not expose achievements.

## Provider onboarding checklist (the real success criterion)

Adding a provider must be exactly these steps, with no product-code edit:

1. `infrastructure/providers/<id>/` — `oauth.ts`, `api.ts`, `map-activity.ts`,
   `map-streams.ts`, `map-zones.ts`, `sport-types.ts`, `index.ts`.
2. `Provider` const + registry entry + capability flags.
3. Env block (`<PROVIDER>_CLIENT_ID/SECRET/REDIRECT_URI`) and one line in
   `PROVIDERS_ENABLED`.
4. Contract-suite fixtures in `server/tests/fixtures/<id>/`.
5. Client: one icon component + one entry in `provider-brand.ts` + the provider's
   i18n label (both catalogues).
6. A webhook route only if `capabilities.webhook` is true.
7. Docs: `README.md` env/setup, `CLAUDE.md` module map, `CONTEXT.md` glossary
   (`Provider`, `Connection`, `Evidence`, `Sync Watermark`, `Ingestion`).

If a provider needs a change outside this list, the seam is wrong — fix the seam,
not the provider.
