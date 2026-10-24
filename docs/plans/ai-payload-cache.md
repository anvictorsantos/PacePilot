# Plan — cache the AI week payload so cache hits skip the limiter

Status: implemented 2026-10-24 (see *Implementation notes* at the end)
Scope: `server/src/modules/ai/**`, `server/src/modules/training/infrastructure/routes/plan.routes.ts`,
`server/tests/unit/**`
Follows: `docs/plans/ai-localisation.md` (shipped), next-week preview (shipped)

## Problem

`GET /api/plan/ai/week` is expensive to *ask*, not only to answer.

Today the route chain is:

```
requireAuthForUserData → aiLimiter (20/h/athlete) → handler
  handler: planWeek() → trainingAI() → cacheGet(athleteId:weekKey:locale:model)
                                       ↑ usually a hit
```

Every page mount spends one unit of the 20/h quota **before** the cache is
consulted. Reloading the plan 20 times in an hour returns 429 even though the
provider was called once (or zero times), and the client shows
`ui.ai_unavailable`. The cache can only prevent provider calls; it cannot prevent
the limiter from firing, because the key needs `plan.week[0].date`, which needs
`planWeek()`, which sits behind the limiter.

The cached value is also an `AiWeekResult`, not the wire body: a hit still costs
`planWeek()` (activities + feedbacks + athlete reads) before
`buildAiWeekPayload()` can map explanations onto dates.

## Goal

A cache hit answers the request **without the limiter and without rebuilding the
plan**. The limiter then protects what it was written to protect: provider
quota, not page refreshes.

### Acceptance criteria

- 30 reloads of the plan page in 10 minutes: every response is 200, at most one
  provider call per locale per week, no 429.
- A cache hit performs exactly one database read (the session's athlete row from
  `requireAuthForUserData`) and zero `planWeek()` calls.
- Response body is byte-identical to what the handler would return, including
  `cached: true` on a hit.
- Invalidation still works on every prompt-input write: activity import,
  feedback, goal change, disconnect.
- Degraded and failed generations are still never cached.
- Locale and model separation preserved.
- The limiter still blocks a *cold* burst: 20 provider-backed requests per hour
  per athlete.

## Decision: cache the wire payload, keyed without the plan

| Option | Limiter on hit | DB on hit | Verdict |
| --- | --- | --- | --- |
| **A. Payload cache + pre-limiter middleware** | skipped | 1 auth read | **Chosen** |
| B. Probe the result cache before the limiter | skipped | still `planWeek()` | rejected: moves the limiter, not the cost |
| C. Raise the limit to 60/h | no | 1 read | rejected: arbitrary, weakens quota protection |
| D. Persist per athlete-week in Mongo | skipped | 1 read (+1 cache read) | deferred: worth it only if instance-local caches prove too cold; separate plan |

The enabling fact: the cache key needs only
`athleteId + weekKey + locale + model`, and `weekKey` is the **Monday of the
current week**, not a value derived from the plan. `buildWeekPlan()` always
aligns to the Mon–Sun week containing `today`, so `weekKey` is computable from
the clock alone.

## Key derivation (the part that must not drift)

`currentWeekKey(now = new Date())` returns `localDateStr(mondayOf(now))` — the
same value `plan.week[0].date` carries. It lives next to `buildWeekPlan()` in
`plan.service.ts` and the route passes it in as `weekKey` **and** uses it for the
cache lookup, so both sides read one value. A regression test pins
`currentWeekKey(today) === buildWeekPlan(state, goal, today)[0].date` for a
mid-week and a Sunday `today` (the Sunday case is where an off-by-one hides).

Local date, not UTC: the plan already builds dates with `localDateStr` for
exactly this reason.

## Implementation

### 1. Cache stores the response body

`server/src/modules/ai/application/quota-cache.ts`

- Type becomes `AiWeekPayload` (the value `buildAiWeekPayload()` returns).
- `cacheGet(key)` returns the body with `cached: true` (the stored copy keeps
  `cached: false`), TTL and LRU unchanged.
- `clearAiCache` / `clearAiCacheForAthlete` keep their names and prefix logic —
  the four call sites already wired (import, feedback, goal, disconnect) do not
  change.
- `aiCacheKey({ athleteId, weekKey, locale, model })` becomes the single builder,
  so no caller concatenates `${a}:${b}:${c}` by hand.

`training-ai.service.ts`

- `trainingAI()` loses its cache read/write. It becomes generate-and-validate
  only: pick provider, retry/fallback, parse, return `AiWeekResult`.
- The route owns caching because it owns the payload. This removes the current
  split where the service caches a result the route has to re-hydrate.
- `AiWeekResult.cached` is deleted; `cached` becomes a payload fact. Anything
  reading `result.cached` goes.

### 2. Pre-limiter middleware

`server/src/modules/training/infrastructure/routes/plan.routes.ts`

```ts
router.get(
  '/ai/week',
  requireAuthForUserData,   // already resolves + caches the athlete row on req
  aiWeekCacheHit,           // new: no limiter cost, no planWeek
  aiLimiter,                // now only guards real generations
  handler
)
```

```ts
async function aiWeekCacheHit(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req)          // hits the req cache, no new query
    const key = aiCacheKey({
      athleteId: session.athleteId,
      weekKey: currentWeekKey(),
      locale: parseAiLocale(req.query.locale),
      model: aiModel,
    })
    const hit = cacheGet(key)
    if (hit) return res.json(hit)
    res.locals.aiCacheKey = key
    next()
  } catch (e) { next(e) }
}
```

- `aiModel` is exported from the service (it is `env.openRouterModel`, the id the
  key has always used); the fallback model is an implementation detail of one
  generation and must not change the key.
- The handler reads `res.locals.aiCacheKey`, calls `planWeek()`, `trainingAI()`,
  `buildAiWeekPayload(plan.week, result)`, and on `result.success` stores the
  body. On degrade it stores nothing — same rule as today.
- `trainingAI` receives `weekKey: currentWeekKey()` so the value it logs/uses and
  the lookup key are the same string.

No route contract change: same path, same query param, same body. Only **when**
it is served moves earlier.

### 3. Memory and eviction

Payloads are larger than results (~2–3 kB vs ~1 kB: dates, role keys, params).
Keep `MAX_ENTRIES = 500` (≈1.5 MB worst case) and note that the value type
changed; if memory becomes a concern, drop to 300 — the working set is
`athletes × locales` for one week, not weeks of history.

## Tests

| File | Assertions |
| --- | --- |
| `ai-payload-cache.test.ts` (new) | set/get roundtrip returns `cached: true`; stored body keeps `cached: false`; per-athlete clear leaves other athletes; key is stable for same inputs and differs on athlete / week / locale / model |
| `plan-week-key.test.ts` (new) | `currentWeekKey(today)` equals `buildWeekPlan(...)[0].date` for Wednesday and Sunday inputs; differs one week later |
| `training-ai.service.test.ts` (rewrite the `quota cache` describe) | with cache removed from the service, two identical calls hit the provider twice; locale separation is now a key-builder assertion, not a service one |
| `ai-week-route.test.ts` (new, middleware unit) | a primed cache calls neither `planWeek` nor `trainingAI` and returns 200 with `cached: true`; a miss calls `next()` once; a degraded miss writes nothing to the cache |

The route test can drive the middleware directly with a fake `req`/`res` and a
stubbed cache; no Mongo and no provider.

Client: no change. `PlanAiWeekResponse.cached` already drives the "cached" pill.

## Verification

```bash
npm test --prefix server
npm run typecheck --prefix server
npx esbuild functions/api.mjs --bundle --platform=node --format=esm \
  --external:express --external:mongoose --external:serverless-http --outfile=/dev/null
```

Manual with `npm run dev`:

1. Open the plan, then reload 25 times inside a minute.
2. Every response 200; server log shows one provider call; every body after the
   first has `cached: true`.
3. Delete a note, save a new one → next load regenerates (`cached: false`).
4. Switch to `en` → one new generation, then hits again.
5. `GET /api/plan/ai/week` 25 times with `AI` disabled → degraded every time,
   still no 429 on the first 20, and nothing cached (a later recovery is
   immediate).

## Rollout and rollback

In-memory only, so a deploy starts empty — no migration. Old and new instances
behave differently for a few seconds during a rolling deploy; both answer the
same contract, so the client does not care.

Rollback: delete `aiWeekCacheHit` from the chain and restore the cache calls in
`trainingAI()`. The payload cache can stay unused; it is bounded and expires.

## Risks

| Risk | Mitigation |
| --- | --- |
| Route key and handler `weekKey` drift, causing permanent misses | One `currentWeekKey()` used for both, plus the equality test against `plan.week[0].date` |
| Cached payload carries dates that disagree with the live plan after midnight | Same key = same Monday = same dates; a new week is a new key |
| Hits bypass the limiter and a stale key serves week-old prose | TTL (6 h) plus the four invalidation hooks; a stale key cannot outlive the week |
| Payload memory grows | 500-entry LRU, values ~2–3 kB, one week of athletes |
| A bug caches a degraded body | Explicit `result.success` guard plus the middleware test with a degraded fixture |
| Session read still costs one query per hit | Accepted: one indexed `_id` read versus a provider call and a full plan rebuild |

## Out of scope

- Persisting the cache in Mongo (survives instance restarts; separate plan).
- Streaming, per-IP quotas, model-level token budgets.
- Caching `/api/plan/week` itself — it is deterministic, cheap, and must reflect
  the latest activity without a TTL.
- Any client change; the UI already renders `cached` and degrades gracefully.

## Implementation notes (2026-10-24)

Shipped as specified:

- `AiWeekPayload` type lives in `ai/domain/coaching-contract.ts`; `AiWeekResult`
  lost its `cached` field, and `trainingAI()` no longer reads or writes a cache.
- `quota-cache.ts` stores payloads, exposes `aiCacheKey()`, and normalizes
  `cached: false` on write / `cached: true` on read.
- `currentWeekKey(now)` exported from `plan.service.ts` next to `mondayOf()`; the
  route uses it for both the lookup and the `weekKey` passed to the service.
- `aiWeekCacheHit` exported from `plan.routes.ts` and installed between
  `requireAuthForUserData` and `aiLimiter`; on a miss it stashes the key in
  `res.locals.aiWeekKey`, and the handler caches only when `result.success`.

Deviations:

- The middleware is unit-tested directly with a pre-resolved session slot, so no
  Mongo is touched (`ai-week-cache-middleware.test.ts`). It covers hit, miss,
  locale separation and the no-identity fall-through.
- TTL expiry is not unit-tested: the cache reads `Date.now()` with no injection
  point. The value is bounded by the same TTL code that shipped before; adding a
  clock seam is a separate cleanup.
- The degraded-not-cached rule is asserted structurally (the handler caches on
  `result.success` only) rather than through an HTTP test, which would need a
  database.

New tests: `ai-payload-cache.test.ts`, `plan-week-key.test.ts`,
`ai-week-cache-middleware.test.ts`; the service's old cache describe became
"no caching in the service".
