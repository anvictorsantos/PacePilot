# Plan — localise AI coaching copy

Status: implemented 2026-10-24 (see *Implementation notes* at the end)
Scope: `server/src/modules/ai/**`, `server/src/modules/training/infrastructure/routes/plan.routes.ts`,
`client/src/modules/ai/**`, `client/src/features/training-plan/**`

## Problem

`/api/plan/ai/week` always returns English prose. Switching the UI to `pt` changes
every catalogue string but leaves the coaching captions in English, so one card
reads:

> **Corrida fácil** · _Captions_ Explain what this session is for in the programme.

Two independent causes, both in code:

1. **The prompt never asks for a language.** `buildCoachingMessages`
   (`server/src/modules/ai/application/coaching-prompt.ts`) says "English" only
   by example — the instructions, the JSON example and the archetype block are
   all English. Nothing in `AiWeekInput` (`ai/domain/coaching-contract.ts`)
   carries a locale.
2. **The cache is locale-blind.** The key in `training-ai.service.ts:99` is
   `` `${athleteId}:${weekKey}:${model}` ``. Even if the prompt were localized,
   the first locale requested would poison the other for the whole TTL.

There is also a third, non-AI leak that would become obvious once the captions
are Portuguese: `plan.service.ts:193` writes `programmeRole` via `dayRole()` in
`ai/domain/plan-archetypes.ts`, which returns English literals
(`'quality session'`, `'cutback week easy run'`, `'<phase> long run, target 21km'`).
`WeeklyScheduleGrid.vue:65` renders it raw above the AI caption. Fixing only the
AI text puts Portuguese prose under an English heading.

## Goal

A locale switch changes **all** athlete-facing prose on the plan, without a
second provider call for a week already generated in that locale, and without
touching the deterministic schedule.

### Acceptance criteria

- `GET /api/plan/ai/week?locale=pt` returns European Portuguese for every
  `aiExplanation` and `aiSuggestionReason`.
- `GET /api/plan/ai/week?locale=en` behaves exactly as today.
- Second call, same locale → `cached: true`, no provider call.
- Call in the other locale → one provider call, then cached independently;
  switching back is a cache hit.
- Missing or invalid `locale` → treated as `pt` (the app's default locale), never
  an error, never a 500.
- `workout.type`, `distance_km`, `duration_min`, `date`, `programmeRole` values
  are unchanged by the locale.
- No new catalogue key is required for AI prose (prose is not a translation unit).

## Decision: generate in the requested locale

| Option | Provider calls per athlete-week | Verdict |
| --- | --- | --- |
| **A. Locale in the prompt, locale in the cache key** | 1 per locale actually viewed | **Chosen** |
| B. One call returning both languages | 1 total, ~2× tokens | Rejected for now; revisit as an optimization if a second locale becomes common |
| C. Generate English, translate on demand | 2 for a pt-only athlete (en + translate) | Rejected: strictly worse for the common case, and adds a second prompt to validate |
| D. Client-side translation | 0 | Not viable: no MT in the bundle, and a static catalogue kills personalisation |

A keeps one prompt, one validator, one contract. The cache already exists and is
keyed per athlete-week, so widening the key is the smallest correct change.

## Contract

`GET /api/plan/ai/week` gains one optional query parameter:

| Param | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `locale` | `'pt' \| 'en'` | `'pt'` | Language of `aiExplanation` / `aiSuggestionReason` |

Response shape unchanged: `week[]`, `suggestions[]`, `model`, `cached`,
`confidence`, `degraded`, `code`.

`locale` is an explicit query parameter, **not** `Accept-Language`. A header
would be set by proxies and browser defaults rather than by the app's own
setting, and would fragment the cache invisibly.

## Pre-flight checks (verified 2026-10-24)

**Athlete notes already reach the AI.** `WorkoutFeedback.notes` is persisted
(server schema allows 2000 chars), loaded by `getRecentFeedbacks()` with no field
projection, passed through `planWeek({ feedbackDays: 14 })` and interpolated into
the user turn as `felt="…"` for the 10 most recent rows. The system prompt tells
the model to weigh it heavily and to prefer recovery on pain/illness/high RPE.
Only `status`/`rpe` feed the deterministic adaptive pass — note text never changes
the schedule, by design. **No change needed for localisation**; the note is
athlete-written free text and is passed through verbatim, so a Portuguese note
works today.

One quality gap exists and is deliberately left alone: the prompt caps a note at
`MAX_FEEDBACK_CHARS = 240`; the feedback schema now enforces the same 240 at the
API boundary and the form uses `maxlength`, so nothing is stored that the prompt
would truncate. The 10-row window remains: an athlete logging daily loses days
11-14 of a fortnight. Out of scope here; worth its own ticket.

**Next Week Preview is not data-driven.** `previewCards` in `TrainingPlanView.vue`
is a hardcoded constant (badges, catalogue titles, `'8.0 km'` / `'9.0 km'` /
`'14.0 km'`), and `NextWeekPreview.vue` carries the same three cards as unused
prop defaults. It reads no plan, no feedback, no AI. It is unaffected by this
work and must not be cited as a source of truth for what next week contains.

## Implementation

### 1. Domain: the locale type

`server/src/modules/ai/domain/coaching-contract.ts`

```ts
export const AI_LOCALES = ['pt', 'en'] as const
export type AiLocale = (typeof AI_LOCALES)[number]
export const DEFAULT_AI_LOCALE: AiLocale = 'pt'

export interface AiWeekInput {
  // …existing fields
  locale: AiLocale
}
```

One file, one concept, per the module rules. `AiWeekResult` is unchanged — the
locale is an input fact, not an output field.

### 2. Prompt: language instruction + glossary

`server/src/modules/ai/application/coaching-prompt.ts`

Add a language block to the system prompt, after the ownership rule and before
the safety rules:

```
LANGUAGE: write every explanation and suggestion reason in European Portuguese
(pt-PT). Use the vocabulary the app already shows the athlete: "corrida fácil",
"corrida longa", "corrida estável", "tempo", "intervalos", "limiar",
"sessão de qualidade", "semana de descarga", "taper". Do not use Brazilian forms
("treino" is fine, "corrida" not "corrida de rua"; no "você"). Keep the numerals,
units and the word "dayIndex" exactly as given. Never answer in English and never
mix languages within the response.
```

Two constraints carried over from the existing design:

- The instruction goes in the **system** turn; the athlete's untrusted block
  stays in the user turn. Do not move it.
- The JSON keys stay English (`weekExplanations`, `suggestions`, `reason`) — only
  values are localized, so `coaching-output.ts` needs no change.

For `en`, emit the same block with English wording, so the asymmetry is a value
choice and not a missing branch.

`describeArchetype()` output is injected head-of-prompt in English. Leave it: it
is scaffolding, not athlete-facing. Add one line to the language block — "the
programme description above is reference material; do not quote it" — because a
Portuguese reply with an English phase quotation is the failure mode to guard.

### 3. Cache key includes locale

`server/src/modules/ai/application/training-ai.service.ts:99`

```ts
const cacheKey = `${input.athleteId}:${input.weekKey}:${input.locale}:${primary.model}`
```

`clearAiCacheForAthlete()` matches on the `${athleteId}:` prefix, so per-athlete
invalidation keeps working unchanged.

### 4. Route validates the parameter

`server/src/modules/training/infrastructure/routes/plan.routes.ts`

```ts
const locale = aiLocaleQuery.parse(req.query.locale) // zod: enum + catch
```

New schema file `training/infrastructure/schemas/ai-locale.ts`, following the
`feedback.ts` pattern: `z.enum(AI_LOCALES).catch(DEFAULT_AI_LOCALE)`. `.catch`
rather than `.default` so `?locale=de` degrades to `pt` instead of 400 — a bad
locale must never break the plan. Pass `locale` into the `trainingAI({...})` call.

### 5. Client sends the active locale

`client/src/modules/shared/infrastructure/http/client.ts`

```ts
aiWeek(locale: 'pt' | 'en'): Promise<PlanAiWeekResponse> {
  return read<PlanAiWeekResponse>(ROUTES.planAiWeek, {}, { locale })
}
```

The locale is a **parameter**, not read from `i18n` inside the HTTP module: that
module is shared infrastructure and must not depend on the app shell.

`client/src/features/training-plan/views/TrainingPlanView.vue`

- `loadAiWeek()` passes `currentLocale()` (from `@/i18n`) into `api.plan.aiWeek()`.
- Watch the active locale and refetch when it changes while the plan is mounted:

  ```ts
  const { locale } = useI18n()
  watch(locale, () => { if (week.value.length) void loadAiWeek() })
  ```

- `aiRequestInFlight` currently drops a second request silently. On a fast
  toggle that is exactly the request we need. Replace the boolean with the
  in-flight locale and re-run once it settles, so the last selection wins:

  ```ts
  let pendingLocale: Locale | null = null
  // in finally: if (pendingLocale && pendingLocale !== requested) run again
  ```

- Clear `aiNotice` before the refetch so a stale "cached" pill does not sit over
  fresh prose.
- `PlanGenerated` analytics fires on `!cached`. A locale switch is now a second
  non-cached response for the same plan, which would double-count the funnel
  step. Track once per `weekKey` and attach `locale` as a property instead.

Merging stays as-is: AI fields are matched by date and spread over the
deterministic workout, so nothing in the schedule can be overwritten.

### 6. Localize `programmeRole` (needed for consistency)

`server/src/modules/ai/domain/plan-archetypes.ts` — `dayRole()` must return a
**key + params**, not an English sentence:

```ts
export type ProgrammeRole = { key: string; params?: Record<string, string | number> }
// 'role.quality' | 'role.cutback_quality' | 'role.long' | 'role.cutback_easy' | 'role.easy' | 'role.rest'
// long run: { key: 'role.long_phase', params: { phase: 'base' | 'build' | 'peak' | 'taper', target: '21km' } }
```

Wire shape: `plan.service.ts:193` emits `programmeRole` (key) plus
`programmeRoleParams`. `WeeklyScheduleGrid.vue` resolves both through
`training-vocabulary.ts` and the catalogue. Add the keys to **both** `pt.json` and
`en.json`.

This is a separate commit from the AI change — it touches the deterministic plan
contract, and the server's `PlanDay` DTO plus the client's `PlanDay.ts` types
have to change together. It is listed here because shipping AI Portuguese under
an English role label would look broken, not because it shares the AI cache.

## Caps, length and truncation

`MAX_EXPLANATION_CHARS = 240` and `MAX_REASON_CHARS = 160` are character caps
enforced by `sanitize()`, which slices silently. Portuguese runs ~20–25% longer
than English for the same content, and the prompt already asks for "max 20
words" — at 20 Portuguese words 240 chars is tight and some captions will end
mid-sentence.

Do this instead of raising the shared cap blindly:

1. Change the word budget in the prompt to `max 18 words` for `pt` (and leave 20
   for `en`), computing it from `input.locale`.
2. Add a unit test that a 18-word Portuguese sentence is under 240 chars.
3. Only if that test fails, raise `MAX_EXPLANATION_CHARS` to 300 — in the shared
   contract, so prompt and validator still cannot drift apart.

## Quota and cost

- Free tier: 50 requests/day for the whole account. Halving the per-athlete
  ceiling matters: today 50 athletes/day, with two locales at worst 25.
- Mitigations already present: 6 h TTL, 500-entry LRU, 20 req/h per-athlete
  limiter, failures never cached. Worst case per athlete-week is bounded at one
  call per locale per TTL.
- Cache entries now split two ways, so the LRU evicts ~2× faster. 500 entries ×
  2 locales is still far above a day's athlete count.
- Do **not** generate both locales eagerly. Pay only for what is viewed.

## Tests

`server/tests/unit/` (`node --test`):

| File | Assertions |
| --- | --- |
| `coaching-prompt.test.ts` (new) | `pt` prompt contains the pt-PT instruction and glossary; `en` contains the English one; untrusted fence still wraps athlete text; JSON keys stay English; word budget differs by locale |
| `training-ai.service.test.ts` | two locales → two provider calls with a fake client; same locale → 1 call, second `cached: true`; pt result cached under the pt key (a subsequent en call is not a hit); failures still uncached and `degraded` in both locales |
| `plan-archetypes.test.ts` | `dayRole()` returns keys/params for every type, including `rest`, cutback and phase-name long run |
| `coaching-contract.test.ts` (new) | 18-word Portuguese explanation fits `MAX_EXPLANATION_CHARS` |

Client `client/src/modules/shared/infrastructure/http/__tests__/client.test.ts`:
`api.plan.aiWeek('pt')` sends `params: { locale: 'pt' }`.

No test touches the network; `OpenRouterClient` stays stubbed.

## Verification

```bash
npm test --prefix server
npm run typecheck --prefix server
npm test --prefix client
npm run typecheck --prefix client
npm run verify:ai --prefix server   # extend to call ?locale=pt then ?locale=en
```

Manual, with `npm run dev`:

1. Load the plan in `pt` → captions in European Portuguese → reload → notice reads
   "cached".
2. Switch to `en` → new call, English captions.
3. Switch back to `pt` → cached, no provider call.
4. `curl 'localhost:3000/api/plan/ai/week?locale=de'` → `pt` content, 200.
5. Confirm `workout.type` and distances are identical across all three responses.

`scripts/verify-ai.mjs` gets a `locale` argument (default `pt`) and prints the
first caption per locale, so the pair of calls is a single command.

## Rollout and rollback

Both sides are additive: the server treats a missing `locale` as `pt`, so a
client deploy that predates this sends no parameter and gets Portuguese — which
is the intended default. Old cache entries (no locale segment) become
unreachable and expire naturally within the 6 h TTL; no migration needed.

Rollback is the inverse: drop the query parameter from the client and the prompt
block from the server. In-flight pt entries expire on their own.

## Risks

| Risk | Mitigation |
| --- | --- |
| Model mixes languages or slips into Brazilian Portuguese | Explicit instruction + glossary; validator caps still apply; manual check on 3 real weeks before merge |
| Model returns English despite the instruction (free models are weak) | Add a cheap post-check: proportion of stopword matches per locale; if the pt request clearly returns English, respond `degraded: 'language_mismatch'` rather than showing English prose in a pt UI. Gate this behind a test with both a matching and a mismatching fixture |
| Truncated Portuguese captions | Word budget + a length test; cap raise only if measured |
| Quota halved at the account level | One call per locale per TTL; limiter unchanged; documented in `docs/ai-integration.md` |
| Locale flip-flop burning requests | `aiRequestInFlight` becomes last-selection-wins, so a burst of toggles settles into one call per locale |
| Locale in the cache key forgotten in a future change | Test asserts a second locale is a miss; the key is built in exactly one place |

## Out of scope

- Streaming, persistence of AI prose across serverless instances, more than two
  locales, translating historic feedback notes the athlete wrote.
- Translating `state.fatigueSignals` and `programme` notes surfaced by
  `/api/plan/week`. Those are deterministic English strings with the same
  problem as `programmeRole`; they deserve the same key-based treatment in a
  follow-up, not a prompt hack.

## Docs to update with the change

- `docs/ai-integration.md` — contract (`?locale`), cache key, quota section,
  language block, the new tests.
- `docs/ai-integration.md` safety/limitations sections if the language-mismatch
  gate ships.

## Implementation notes (2026-10-24)

Shipped:

- `AI_LOCALES`, `AiLocale`, `DEFAULT_AI_LOCALE`, `explanationWordBudget` in
  `ai/domain/coaching-contract.ts`; `AiWeekInput.locale`.
- Locale language block + per-locale word budget in `coaching-prompt.ts`.
- `ai-locale.ts` schema (`.catch`, never 400) and `?locale` wiring in
  `plan.routes.ts`; cache key gained the locale segment.
- `programmeRole` is now a catalogue key + `programmeRoleParams`; `dayRoleKey()`
  and `phaseSlug()` added next to `dayRole()`, which stays as prompt scaffolding.
  Client resolves through `programmeRoleLabel()`; 5 role keys, `target_suffix`
  and 14 phase keys in both catalogues.
- Client sends the active locale, refetches on a language switch, last selection
  wins while a request is in flight, and `PlanGenerated` fires once per week.
- `verify:ai` takes a locale argument.

Deferred, deliberately:

- The language-mismatch detector (risk table) is not built. Free models are
  instructed, not guaranteed; a wrong-language response is still schema-valid and
  would render as-is. If it shows up in practice, the mitigation is the stopword
  proportion check returning `degraded: 'language_mismatch'`.

Tests added: `coaching-prompt.test.ts` (language block, word budget, 18-word fit,
untrusted fence), locale-isolation case in `training-ai.service.test.ts`,
`dayRoleKey`/`phaseSlug` cases in `plan-archetypes.test.ts`, locale query in the
client HTTP test.
