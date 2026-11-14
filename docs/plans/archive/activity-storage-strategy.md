# Plan — activity storage strategy

Status: superseded 2026-10-25 — Option C was implemented and then reverted.
Final shape: enrichment fields keep being written on `activities`; retention is
a 90-day TTL on `date` (see _Final decision_ at the end).
Scope: `server/src/modules/activities/**`, `server/src/modules/providers/**`,
`server/src/modules/training/**`, `server/src/modules/progress/**`,
`server/scripts/ensure-indexes.mjs`

Question this answers: can the `activities` collection be dropped in favour of
reading Strava's API on demand, or kept to a short rolling window and pruned?

## Current approach (measured)

### What is stored

`activities` (Mongoose `Activity`) holds one row per provider activity, keyed by
`{provider, provider_activity_id}` (unique, partial). Fields fall in three weight
classes:

| Class       | Fields                                                                                                                                   | Notes                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Summary     | `date`, `sport`, `sport_type`, `kind`, `workout_type`, `distance_*`, `moving_time_*`, `avg_*`, `has_hr`, `achievement_count`, `pr_count` | ~1–2 kB                     |
| Enrichment  | `laps`, `trophies`, `zones`                                                                                                              | small                       |
| Heavy       | `streams` (`time`, `distance`, `velocity_smooth`, `heartrate`, `latlng`), `raw`                                                          | can be 100+ kB per activity |
| Bookkeeping | `detail_synced_at`, `detail_version`, `athlete`, timestamps                                                                              |                             |

Indexes: `{athlete, date:-1}` and the unique provider pair. **No TTL, no
retention, no pruning anywhere.** `scripts/ensure-indexes.mjs` only de-duplicates
feedback rows.

### How much history is imported

`activity-import.service.ts`:

- First sync: no `after` → the most recent **500** activities (10 pages × 50).
- Later syncs: `after = last_synced_at − 14 days` (late uploads), same 500 cap.
- Minimum 15 minutes between automatic syncs (`SYNC_MIN_INTERVAL_MS`), on app load.
- Strava webhooks are now used: a push delivery fetches the one activity and
  writes it through `persistActivities`. The 15-minute pull window remains the
  fallback, so the pull path still bounds how stale a missed delivery can be.

So the DB is already a _bounded recent mirror_, not an archive: nothing older
than 500 activities is ever imported, and nothing is ever removed.

### What reads it

| Consumer                     | Depth needed                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `training-state.ts`          | 7 / 14 / 28 days; consistency 28 days                                           |
| `plan.service.ts` / adaptive | 28-day state + long-run clamp                                                   |
| `build-progress.ts`          | `weeklyVolumeSeries(runs, 8)` → **8 weeks (56 days)**                           |
| `activities` routes          | page/skip list (`total` is a count query); detail enriches lazily               |
| detail view                  | one `getActivity` + one `getStreams` call on first open, then cached on the row |
| AI prompt                    | last 5 activities                                                               |
| run-day / schedule           | today + current week                                                            |

### Provider constraints (from Strava docs, fetched today)

- OAuth bearer tokens; access token 6 h, refresh token rotates.
- Non-upload limits, default app: **100 requests / 15 min, 1 000 / day**.
  Upgraded (10 athletes): 200 / 15 min, 2 000 / day. Beyond 10 athletes: review.
- Athlete capacity: 1 by default, 10 after upgrade.
- Listing is paginated (`per_page`, max 200). Laps/streams are **not** in the list
  payload — each opened activity costs 1–2 more calls.
- Strava explicitly recommends webhooks over polling, and warns that polling and
  backfill are what exhaust limits.
- API agreement: data only shown to that athlete, deleted on termination;
  no competing-app use.

### What that means

- Dropping the collection trades deterministic local reads for provider latency,
  rate limits and outages.
- One week of history is **not enough**: the plan needs 28 days and the progress
  chart needs 56.
- The real weight is `streams`/`raw`, not the summary rows. Deleting whole rows
  destroys plan determinism to save bytes that a field-level prune would recover.

## Options

### Option A — API-only (no `activities` collection)

Read the provider on every plan/progress/activity request, cache pages in memory
(or Redis) for 5–15 minutes. Persist only the connection and HR zones.

**Changes**

- Remove `Activity`, `persistActivities`, sync watermark logic.
- New read-through cache keyed by `{athlete, range}` with TTL.
- `training-state`, `plan.service`, `build-progress` take `CanonicalActivity[]`
  from the cache instead of Mongo queries.
- Detail view always calls `getActivity`/`getStreams`.

**Feasibility**

- 56-day chart ≈ 30–60 activities ≈ 1 list call per athlete per cache miss.
- 10 athletes × one plan/progress view per 15 min ≈ 20 read calls per window,
  against 100/15 min — fits, with no headroom for detail views or retries.
- Every cold start / deploy re-fetches; no webhook means no push freshness.

**Fails on**

- Offline/standalone PWA (the shell opens with no data).
- Strava outage or 429 → no plan at all, not a degraded card.
- Plan determinism: an edited or deleted Strava activity silently rewrites past weeks.
- Detail views: 2 calls per opened activity, unbounded by user clicks.
- Historical deep links beyond 500 activities; pagination cost.
- Athlete-capacity and review constraints if the user base grows.

**Verdict**: rejected for this product. Only sane if the app were single-player,
always online, and had no history views.

---

### Option B — Rolling window (the "keep last week" idea, corrected)

Keep rows for a bounded window, delete older ones. The window cannot be one week.

**Minimum window**

- 28 days for `training-state` (hard sessions, long run, average pace, consistency).
- 56 days for the 8-week volume chart.
- Plus a safety margin for late uploads and timezone edges.

→ **90 days** is the smallest defensible window. One week breaks the plan the
moment the athlete passes seven days.

**Changes**

- Retention job: `Activity.deleteMany({ date: { $lt: now − 90d } })`, scheduled
  (deploy hook, cron, or an admin script run weekly).
- Optional TTL index on `date` — simplest, but it deletes summaries too.
- Keep the import overlap (14 days) so re-syncs do not resurrect pruned rows.
- Decide what happens to an activity page for a pruned id: 404, or fetch by
  provider id on demand.

**Pros**

- Small, bounded collection; straightforward; no schema split.
- Plan and charts keep working inside the window.

**Cons**

- Destroys long-term history the product already renders (activity list paginates
  over everything stored).
- TTL on `date` also removes summaries that cost little.
- Still needs the provider for anything older, with the same rate-limit caveats.
- A late correction older than the window is lost.

**Verdict**: viable as a safety net, not as the primary design.

---

### Option C — Slim summaries forever + expiring details (recommended)

Split the weight classes. Keep summary rows permanently; put heavy enrichment in
its own document with a TTL.

**Shape**

- `Activity` keeps only the summary class + `detail_synced_at`/`detail_version`
  (the price of a row drops to ~1–2 kB).
- New `ActivityDetail` collection keyed by `{provider, provider_activity_id}`:
  `laps`, `streams`, `streams_available`, `trophies`, `zones`, `raw`.
- Mongo TTL index on `ActivityDetail.expires_at` (e.g. 30 days). Re-opening an
  activity after expiry re-fetches once, as the detail route already does today.

**Changes**

- `activity.service.ts`: `normalize*` output splits into summary + detail.
- `persistActivities`: writes summary every sync; never touches detail.
- Detail route: read `ActivityDetail`; on miss fetch + upsert with a fresh
  `expires_at`; read model unchanged.
- Account erasure (`me.routes.ts`) already deletes `Activity` inside a session
  transaction. `ActivityDetail` must join that transaction, or a deleted account
  leaves heavy rows behind until the TTL fires.
- Migration: move existing `streams`/`laps`/`raw`/`trophies`/`zones` out of
  `Activity`, then `$unset` them.
- The sync route currently includes `raw` in `writePayload` — drop it from the
  summary write.

**Pros**

- Plan, charts, list and deep links keep working offline and deterministically.
- Removes the bulk of the bytes; TTL does the pruning without a cron.
- No behaviour change for the athlete except a one-time re-fetch after 30 days.

**Cons**

- Two collections and a migration.
- Detail latency after expiry (~1–2 calls).

**Verdict**: recommended. It answers the intent of the question (stop hoarding
heavy rows) without giving up plan correctness.

---

### Option D — Hybrid API-first history

Option C plus on-demand pagination for history older than the stored window:
the activity list can page past local data by fetching provider pages, while
plans/charts always read local summaries.

**Changes**

- Option C, then a `provider` fallback in the list route when the local
  page/skip reaches the end.
- Cache provider pages briefly; dedupe against local rows.
- Weekly aggregates persisted so charts never need provider pages.

**Pros**

- Unlimited visible history with a small DB.

**Cons**

- Two data sources with different freshness; more edge cases (deleted Strava
  activities still shown locally).
- Rate limits apply to the list endpoint, exactly where users scroll most.
- Complexity for a feature nobody has asked for yet.

**Verdict**: defer until history depth becomes a product requirement.

## Comparison

|                                    | A API-only   | B Rolling 90d          | C Slim + TTL details                   | D Hybrid    |
| ---------------------------------- | ------------ | ---------------------- | -------------------------------------- | ----------- |
| Plan deterministic / offline       | no           | yes (in window)        | yes                                    | yes         |
| Strava calls per plan view         | 1–2          | 0                      | 0                                      | 0           |
| Detail view calls                  | 2 always     | 2 if pruned            | 2 after TTL                            | 2 after TTL |
| DB growth                          | tiny         | bounded rows           | bounded bytes, ~unbounded rows (cheap) | small       |
| Migration                          | large        | small job              | medium (split + backfill)              | large       |
| Failure mode when Strava is down   | app unusable | plan ok, old pages 404 | plan ok, details cached/empty          | plan ok     |
| Compliance (delete on termination) | trivial      | easy                   | easy + TTL                             | easy        |

## Recommendation

1. **Option C first.** It removes the actual cost (`streams`, `raw`) and keeps the
   properties the product depends on: deterministic plan, 8-week chart, offline
   shell, no API dependency on page load.
2. Keep summaries indefinitely; they are cheap and make deep links stable.
3. Only then consider **Option B** if row count itself becomes a problem: a
   12-month summary retention window, never 7 days.
4. Revisit **Option D** only when history depth is a product requirement.
5. If API-only ever becomes attractive (single-player mode), the precondition is
   Strava webhooks plus a read-through cache, not polling.

## Implementation sketch for Option C

Phase 1 — schema split

- `ActivityDetail` model with TTL index on `expires_at`.
- `activity.service.ts` split: `toSummaryDoc()` / `toDetailDoc()`.
- `persistActivities` writes summaries only.
- Detail route reads/writes `ActivityDetail`; response shape unchanged.

Phase 2 — migration

- Script: for each `Activity` with `streams`/`laps`/`raw`/`trophies`/`zones`,
  copy into `ActivityDetail` with `expires_at = now + 30d`, then `$unset` on the
  activity row.
- Idempotent, batched, dry-run flag first.

Phase 3 — cleanup and limits

- Remove `raw` from the sync payload entirely (nobody reads it; it is the largest
  single field).
- Keep the list route's `.select('-raw')` correctness (now unnecessary).
- Add a size check to the ops script: report `activities` vs `activitydetails`
  bytes before/after.

## Acceptance criteria

- `GET /api/plan/week`, `/plan/today`, `/progress`, `/activities` produce byte-identical
  bodies before and after the migration for the same data.
- Opening an activity after detail expiry re-fetches once and caches again; a
  second open makes no provider call.
- No `streams`/`raw`/`laps` on `Activity` documents after migration.
- TTL removes detail docs, never summary rows.
- Tests: split mapping (summary/detail), detail-miss fetch path, migration script
  idempotence, a regression that `build-progress` still sees 8 weeks, and account
  erasure deleting `ActivityDetail` rows too.

## Risks

| Risk                                           | Mitigation                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| Detail TTL too short → repeated provider calls | 30 days; opening the same activity twice is cached                     |
| Migration partially applied                    | Batched + idempotent + dry run; `$unset` only after successful copy    |
| Provider-agnostic assumptions                  | Split lives in canonical shapes, not in the Strava adapter             |
| Retention expectations                         | Document in privacy copy that summaries are kept, heavy samples expire |

## Out of scope

- Webhook subscription (shipped in issue #10: the push path reuses the pull
  writer and the 15-minute pull stays as the fallback).
- Redis/external cache; multi-instance coordination.
- Strava API version changes, athlete-capacity review.
- Compressed binary stream storage (protobuf/BSON binary) as a further size step.

## Final decision (2026-10-25)

Option C (split summary/detail, TTL on the detail document) shipped, migrated,
then was reverted at product direction.

What replaced it:

- `laps`, `streams`, `streams_available`, `trophies`, `zones` and `raw` stay on
  the `activities` document and keep being written by sync and by the detail
  route. They are used by the activity screen, so splitting them added a join and
  a refetch for no product gain.
- Retention is by activity date: a Mongo TTL index on `date` with a **90-day**
  window (`ACTIVITY_RETENTION_DAYS` in `Activity.ts`, index name
  `activity_date_ttl`). Mongo deletes a document once `date + 90d < now`.
- 90 days is the minimum honest window: the deterministic plan reads 28 days of
  state and the progress chart reads 8 weeks (56 days). A one-week window would
  break `longRun28`, `avgPace28`, `hardSessions14`, consistency and the chart.
- `npm run db:indexes` builds the TTL along with the other indexes. Changing the
  window means dropping and rebuilding the index; Mongoose never alters an
  existing `expireAfterSeconds`.

Migration trail (recorded so it is not repeated): the split copied two populated
detail documents, cleaned 495 empty/raw-only rows, then the reversal copied the
two documents back into `activities` and dropped `activitydetails`. The
`migrate-activity-details` script and `ActivityDetail` model no longer exist.

Consequence to accept: activity history older than 90 days is gone, including
deep links. If long-term history becomes a requirement, use Option D (provider
backfill pages) rather than widening the window indefinitely.
