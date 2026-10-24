# AI integration (OpenRouter, free tier)

Coaching copy for the weekly plan. The **deterministic engine owns the schedule**
(`buildWeekPlan`); AI only adds an explanation per day and an optional, separately
labelled suggestion. Nothing the model returns can change a workout type, distance
or duration that `/api/plan/week` already returned.

## Files

| File | Role |
| --- | --- |
| `src/config/env.ts` | Config + free-model guard (refuses a non-`:free` id in production) |
| `src/services/openrouter-client.ts` | Provider isolation: HTTP, retries, error mapping, free-catalog check |
| `src/services/ai/plan-archetypes.ts` | Per-distance programme structure, phases, long-run progression |
| `src/services/training-ai.service.ts` | Business logic: prompt, validation, safety gate, quota cache |
| `src/routes/plan.routes.ts` | `GET /api/plan/ai/week`, `GET /api/plan/ai/status` |
| `client/src/services/plan.ts` | `getPlanAiWeek()`, `getAiStatus()` |
| `client/.../TrainingPlanView.vue` | Fetches AI after the plan renders, merges by date |

## Plan archetypes (race-specific coaching)

`src/services/ai/plan-archetypes.ts` encodes the shape of each race-distance
programme: length, sessions per week, phases, long-run progression, cutback
weeks, taper shape and the athlete's pace vocabulary.

| Goal | Programme | Min recommended | Week shape (easy/speed/long/rest) | Cutbacks |
| --- | --- | --- | --- | --- |
| 5K | 8 weeks | 4 | 2 / 2 / 1 / 2 | none claimed |
| 10K | 8 weeks | 4 | 2 / 2 / 1 / 2 | week 4 |
| Half marathon | 14 weeks | 6 | 2 / 2 / 1 / 2 | weeks 10, 6 |
| Marathon | 18 weeks | 12 | 3 / 1 / 1 / 2 | weeks 16, 13, 10, 6 |

Marathon long-run build: 10 → 11.25 → 10 (cutback) → 13 → 16 → 15 (cutback) →
20 → 21.1 km → cutback → 120 min → 22-26 → 26-29 → 90 min (cutback) →
29-35 km (peak) → 24-26 → 19-23 → 16 → race.
Half: 6.4 → 8 → 10 → 10 → 13 → 15 → 16 → 16 → 13.1 km → 20 km → 60 min →
11 km → race.
5K long runs are time-based early (15 → 25 → 30 → 33 min), then distance
(6.5 km, 5 km, race).

Structure and method were derived from the published Nike Run Club training
programmes for these four distances. Wording here is original; no source text is
reproduced, and a test asserts the module never contains a verbatim phrase from
them. No cutback week is claimed for the 5K — the source does not show one.

`describeArchetype(goalType, weeksOut)` renders the block injected into the
system prompt. `dayRole(archetype, weeksOut, workoutType)` returns the
server-computed label returned to the UI as `programmeRole`.

**Why the role is computed server-side rather than asked of the model:** a free
120B model shown a phase name per day repeats it in prose and drifts — it called
a taper week "base". Only the long run carries a phase name in the prompt, and
the deterministic `programmeRole` is what the UI renders, so the label beside
the AI caption is always correct.

**Unit note:** the archetype index is in *weeks out*. The runtime path once
passed *days*, which made a 4-weeks-out marathon look like week 28 and silently
reported "base" for every athlete. Covered by a regression test.

## Deterministic programme planner

`src/services/plan/programme.ts` replaces the old fixed
`['easy','tempo','easy','long']` cycle that `buildWeekPlan` used for every
athlete regardless of goal. The week now follows the archetype: how many easy /
quality / long / rest days, which days carry the hard work, and what this week's
long run should be.

Two rules:

1. **The programme is a ceiling, not a command.** Long-run targets are clamped to
   `longest recent run + 2 km`, and an athlete with no run history is capped at
   the template long run. When the clamp bites, the week carries a note saying
   so — it is never applied silently.
2. **Safety stays outside it.** The programme decides what an ideal week looks
   like; `plan/adaptive.ts` still gets the final word on the athlete's actual
   state (RPE, skips, fatigue) and runs afterwards, unchanged.

Also fixed by this work:

- `days_per_week` was ignored entirely; it now bounds the number of sessions.
- The two quality sessions in a speed-led programme get different stimuli
  (tempo / interval, tempo / threshold) rather than the same workout twice.
- The long run prefers a weekend day when one is available.
- A quality session is never placed adjacent to the long run.
- Taper drops hard sessions entirely and no longer double-counts the taper phase
  with an extra volume cut.

`GET /api/plan/week` returns `programme` (phase, weeks out, cutback/taper flags,
long run km vs target, notes) and a per-day `programmeRole`. Both are
deterministic and render whether or not the AI is available.

## Environment

Copy the block from `.env.example` into `server/.env`:

```
OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free
OPENROUTER_FALLBACK_MODEL=xingchen-agi/xing4.0-29b-a4b:free
OPENROUTER_TIMEOUT_MS=20000
OPENROUTER_TEMPERATURE=0.4
OPENROUTER_MAX_TOKENS=700
OPENROUTER_REASONING_MAX_TOKENS=0
OPENROUTER_MAX_RETRIES=1
OPENROUTER_RETRY_BASE_MS=400
AI_CACHE_TTL_MS=21600000
```

The key is read server-side only. It is never sent to the browser, never logged,
and never included in an error message.

## Get a key

1. Sign in at <https://openrouter.ai/> (free account, no card required).
2. Create a key at <https://openrouter.ai/keys>.
3. Put it in `server/.env` as `OPENROUTER_API_KEY`. `.env` is git-ignored.

## Pick a free model

Only ids ending in `:free` are accepted; a non-free id throws at startup in
production, so this project cannot bill you by accident.

- Live free list: <https://openrouter.ai/models?fmt=cards>
- Machine-readable: `GET https://openrouter.ai/api/v1/models`
  (an entry is free when `pricing.prompt === 0` and the id ends in `:free`)
- In-app check: `GET /api/plan/ai/status` → `modelStillFree`, plus the full
  free catalog and whether each entry supports JSON mode.

Rules when choosing:

1. Must end in `:free`.
2. `OPENROUTER_MODEL` and `OPENROUTER_FALLBACK_MODEL` should be served by
   **different upstream providers**. The two `google/gemma-4-*:free` ids both
   route to Google AI Studio — as a pair they provide no redundancy, and one
   saturated shared pool 429s both.
3. Prefer a model listing `response_format` in `supported_parameters`; the
   service requests JSON mode.
4. If the model is a reasoning model, keep `OPENROUTER_REASONING_MAX_TOKENS=0`.
   Unbounded thinking silently consumes `OPENROUTER_MAX_TOKENS` and the response
   comes back empty.

Free-tier limits (per OpenRouter, whole account, all athletes combined):
20 requests/minute, 50 requests/day below 10 credits purchased, 1000/day at or
above it. Check live usage with `GET /api/v1/key` → `free_model_daily_requests`.

## Cost control

- `AI_CACHE_TTL_MS` — per-athlete-week result cache (default 6h). This is the
  primary control: one provider call serves every view of that athlete's week.
- `aiLimiter` on `/api/plan/ai/week` — 20 requests/hour per athlete.
- `OPENROUTER_MAX_TOKENS` — hard cap on completion size.
- `OPENROUTER_MAX_RETRIES` — bounded; retries fire only on 429/5xx/network.
  Set `0` on a key with a small daily allowance.
- Free models are never assumed to be available or unlimited. When the provider
  fails, the endpoint returns HTTP 200 with `degraded` set and no AI fields — the
  plan still renders.

## Error handling

| Provider condition | Behaviour |
| --- | --- |
| 429 (platform quota) | `degraded: "AI free-tier quota exhausted — try again later"`, not cached |
| 429 (upstream pool) | retried once, then the configured fallback free model |
| 401 / 402 | no retry, no fallback — needs a config fix |
| 404 (model gone) | fallback free model |
| timeout / network | bounded retry, then fallback |
| unparseable output | `degraded`, deterministic plan untouched |

Provider error bodies are never forwarded — they can echo prompt content.

## Safety gate

Model suggestions are discarded unless all hold:

- target day is not a rest day
- `suggestedType` is one of `easy`, `recovery`, `long`, `steady`, `tempo`,
  `threshold`, `interval`
- no intensity escalation (`tempo`/`threshold`/`interval`) when the athlete has
  fatigue signals or already has 2+ hard sessions in 7 days
- no `long` suggestion beyond the progression guard
- `reason` present; ≤3 suggestions; one per day; `dayIndex` in 0–6

All AI strings are stripped of control characters and length-capped
(240 chars for explanations, 160 for reasons).

## Untrusted input

Athlete-written notes and activity labels are interpolated into a
`<<<UNTRUSTED_ATHLETE_DATA` block inside the user turn. The system prompt states
the block is data and forbids following instructions in it. This is prompt-level
containment only — output is still schema-validated before it reaches a client.

## Tests

```bash
cd server && npm test          # provider + AI service, all mocked
cd client && npm test          # client service layer
```

No test touches the network or consumes free quota: `openrouter-client.test.ts`
stubs axios, `training-ai.service.test.ts` injects a fake client.

## Manual verification

```bash
cd server
npm run dev
node --disable-warning=ExperimentalWarning scripts/verify-ai.mjs
```

Loads `server/.env`, signs a session for the first athlete in the database and
calls both endpoints. Expected: `modelStillFree: true`, a 200 from
`/api/plan/ai/week` with one explanation per day, then `cached: true` on the
second call.

Health check without a session:

```bash
curl -s localhost:3000/api/plan/ai/status
```

## Limitations

- Suggestions are surfaced but not auto-applied; the user acts on them.
- The cache is in-memory, so it resets per serverless instance and on deploy.
- No streaming. Free models are slow enough (3–15s) that the UI shows a loading
  state instead; streaming would need SSE through the Netlify function.
- The free catalog changes often. A model can vanish between status checks.
