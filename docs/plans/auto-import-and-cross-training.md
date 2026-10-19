# Plan — auto-import activities, modal sync, cross-training interference

Status: implemented 2026-10-19 (WS1–WS3), see "Implementation notes" at the end.

## Outcome

1. Activities import automatically for a connected athlete; the `/strava` page no longer exists.
2. The notification panel's bottom action is **Sync your activities** and syncs in place, modal stays open.
3. Every imported activity type feeds the race plan: non-runs add load and interference, they do not add distance.

## Locked decisions

- **Cross-training impact** — load + interference only. Distance, run counts and pace windows stay run-only.
- **Auto-sync cadence** — on authenticated app load when `last_synced_at` is older than 15 minutes; the server returns `skipped` inside that window; the manual button forces.
- **Granularity** — `sport_type` level only. Strava exposes no per-exercise data on read (`/docs/uploads/` `exercise_type` values are accepted on upload only; `DetailedActivity` carries no `sets`).

## Constraints discovered

- Readable Strava surface: `sport_type` (56 values), `distance`, `moving_time`, `elapsed_time`, `total_elevation_gain`, `average_heartrate`, `max_heartrate`, `calories`, `achievement_count`, `pr_count`. `suffer_score` only on the detailed endpoint.
- The plan is recomputed per request (`loadTrainingData` → `calcTrainingState` → `adaptiveCombined`). No stored plan to migrate; the work is inputs + cache invalidation.
- `plan.service.ts` currently filters `sport ∈ RUN_SPORTS` (added 2026-10-19). WS3 reverts that in favour of an explicit domain split.
- `Activity.workout_type` already has an `'other'` member for non-runs; WS3 generalises it into `kind`.
- Connect lives in `LoginView`; disconnect in `StravaConnectView`. Only `AppHeader.vue:94` and `SettingsView.vue:96` link to `/strava`.
- Client read caches: `RESOURCE_KEYS` in `modules/shared/infrastructure/resource-keys.ts`; list keys are dynamic (`activities:${filter}:${page}`) so a prefix reset is needed.
- AI week cache: `modules/ai/application/quota-cache.ts`, key `${athleteId}:${weekKey}:${model}`, TTL 6 h default, no per-athlete invalidation today.

## WS1 — auto-import, delete `/strava`

1. `client/src/modules/strava/application/use-case/SyncActivities.ts` — one `execute({ force })`: POST sync, map 429/401/other to toasts, publish `ActivitiesImportedDomainEvent` when `imported > 0`. Moves `StravaConnectView.vue:118` `sync()`.
2. `client/src/modules/strava/infrastructure/composable/useAutoSync.ts` — on authenticated layout mount: `useSession().checkStatus()` → stale check against `strava.status.last_synced_at` (15 min) → `SyncActivities.execute()`. In-flight guard; never runs for a disconnected athlete.
3. `server/src/modules/strava/infrastructure/routes/strava.routes.ts` — after auth, inside the 15 min window and without `?force=1`, answer `200 { skipped: true, last_synced_at }` without calling Strava.
4. Delete `client/src/router/index.ts:40-42` and the view `client/src/features/strava/`; drop the `AppHeader.vue:94` link; `SettingsView.vue:96` → `router.replace('/login')`; add a connect/disconnect card to `SettingsView` (connect → `/api/strava/authorize`, disconnect → `api.strava.disconnect()` + `clearUser()` + `setConnected(false)`).

## WS2 — panel action becomes "Sync your activities"

1. `client/src/layouts/NotificationCenter.vue:147-152` — `RouterLink` → `<button>` calling `SyncActivities.execute()`; disabled while in flight; `min-h-touch` retained; `useDialog` already owns focus/escape.
2. On success: toast (`strava.sync.importedOne/Other`, `upToDate`) then `fetchBell(true)` so rows appear without closing.
3. i18n `notifications.syncActivities` in `en.json` + `pt.json`. Decide whether a secondary `/activities` link stays.

## WS3 — cross-training influences the plan

1. `server/src/modules/activities/domain/value-object/ActivityKind.ts` — enum `run | ride | swim | strength | hiit | mobility | other`.
2. `server/src/modules/activities/domain/value-object/SportType.ts` — all 56 `sport_type` values → `ActivityKind`. Unknown value → `other`. One concept per file.
3. `activity.service.ts::normalizeActivity` stores `sport_type` + `kind`; `Activity.ts` schema gains `kind` (+ enum). Runs keep `workout_type`.
4. `training-state.ts` — add `crossLoad7/28` (duration × intensity proxy from `avg_hr`/`calories`/kind) and `hardCrossSessions7`; distance/run/pace windows untouched.
5. `adaptive.ts` — `adaptiveFromInterference(lastSessions, baseType)`: hard `hiit|strength` within 24 h before a quality day → downgrade; hard cross the day before the long run → ease; hard cross within 24 h after a hard run → next quality day downgraded. Returns the existing `AdaptiveChange` with a `reason`.
6. `plan.service.ts:129` — load all activities again; split runs vs cross in the domain, not the query.
7. `quota-cache.ts` — `clearAiCacheForAthlete(athleteId)`; sync route calls it after a write so coaching copy is not stale for the TTL.
8. `client/src/modules/shared/infrastructure/http/client.ts` — no change expected; activity DTO gains `kind`.

## Cross-cutting

- `client/src/modules/strava/domain/event/ActivitiesImportedDomainEvent.ts` + `modules/strava/application/use-case/subscriber/InvalidateReadsOnActivitiesImported.ts` resetting `planWeek`, `progress`, `stravaStatus` and `activities:*`. Mirrors `run-day/.../InvalidateStaleReadsOnFeedbackLogged`.
- `useResource.ts` — add `resetResourcePrefix(prefix)` for the dynamic list keys.
- Analytics: `TrackWorkoutLogged` fires on `RunDayCompletedDomainEvent`. Cross-training counting as a logged workout is **not** in scope; decide separately.
- Every new string in `en.json` + `pt.json`.

## Sequencing

1. `SyncActivities` extraction, `resetResourcePrefix`, invalidation subscriber (refactor only).
2. WS2 panel button.
3. WS1 auto-sync, route/view deletion, Settings card.
4. WS3 taxonomy → normalization → state → interference → AI cache clear.

## Verification per step

- server: `npm run typecheck --prefix server`, `npm test --prefix server`; boot with `--import ./scripts/register-alias.mjs` when routes change.
- client: `npm run typecheck --prefix client`, `lint`, `format:check`, `test`, `build` (chunk budget 500 kB).
- `npx playwright test` (a11y) once the modal and route removal land.

## Risks

- Auto-sync + quota: the server-side `skipped` guard is the backstop; 15 min × N tabs still costs requests.
- Interference weights are a prescription behaviour change; needs fixtures, otherwise the plan twitches on a strength day.
- Deleting `/strava` breaks bookmarks and back-button history.
- Erase-account path (`me.routes`) deletes activities; the invalidation subscriber must tolerate a missing athlete.

## Implementation notes

- Invalidation is a port (`ImportedActivitiesCache`) called by `SyncActivities`, not a
  domain event: the event bus snapshots subscribers when `run-day-container` evaluates,
  so a strava subscriber bound later would never be registered (and binding earlier
  duplicates every existing handler). The port is deterministic and testable.
- Auto-import is silent (`announce: false`); failures still toast because they need action.
- Strava throttle: `POST /strava/sync` returns `{ guarded: true }` inside 15 minutes unless
  `?force=1`. The manual button forces; app load does not.
- Cross-training does not complete a `RunDay` (client `RefreshRunDay` filters runs).
- Server `ActivityKind` is a const object, not a TS enum: the server runs through Node's
  strip-only type removal, which rejects enum syntax.

