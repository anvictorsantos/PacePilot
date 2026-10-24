# Plan — make Next Week Preview real

Status: implemented 2026-10-24 (see *Implementation notes* at the end)
Scope: `server/src/modules/training/{application/plan.service.ts,infrastructure/routes/plan.routes.ts}`,
`client/src/features/training-plan/**`, `client/src/modules/training/infrastructure/dto/**`,
`client/src/i18n/*.json`

## Problem

"Next week preview" shows three invented sessions.

Evidence:

- `TrainingPlanView.vue:108-133` — `previewCards` is a module-level constant: badge
  key, catalogue title/desc, and literal `'8.0 km'`, `'9.0 km'`, `'14.0 km'`.
- `NextWeekPreview.vue:46-65` — the same three cards are duplicated as unused prop
  defaults. The parent always passes `items`, so the fallback never renders, but it
  is a second copy of the lie.
- Neither path reads `week`, `planWeek(+7d)`, `feedbacks`, or `aiWeek()`.

Consequence: a marathon athlete in a cutback week, a 5K athlete in taper, and a
general-fitness athlete with no goal all see an intervals + tempo + 14 km week
that does not exist. The card says "Estimated" next to numbers that were typed by
hand.

## Goal

The section renders next week's actual programme output — same engine, same rules — or
disappears when there is no next week to preview.

### Acceptance criteria

- Every card's distance, badge and type come from the server's next-week plan.
- Card order is stable and explainable: long run first, then quality sessions in
  date order, then easy sessions, capped at three.
- The section is hidden, not blank and not filled with placeholders, when the
  response carries no next week (goal already passed, insufficient data, or an
  older server that does not send the field).
- No extra HTTP call: the data rides on `GET /api/plan/week`.
- No AI call, no new provider quota, no change to the current week.
- Rest days never become cards.

## Decision: extend `/api/plan/week`, programme-only

| Option | Cost | Verdict |
| --- | --- | --- |
| Add `nextWeek` to the existing week payload | 0 extra requests, ~2 kB, no extra DB read | **Chosen** |
| New `GET /api/plan/week/next` | second round trip + second `loadTrainingData` | rejected |
| Derive client-side from `programme` + archetype | duplicates engine rules in TypeScript on the client | rejected — two sources of truth for a long-run target |

`planWeek()` already loads state, goal, feedbacks and activities. Building a second
week from that is pure computation.

### Why the preview is not adapted

`buildWeekPlan()` runs two adaptive passes: the "next workout only" pass on
`isToday`, and a skip pass that softens the remaining slots of the same week.
Both read the 7-day Feel Window. Applying today's fatigue to a session seven days
away would downgrade a workout for a state the athlete may no longer be in, and
the skip pass would rewrite a week the athlete has not started.

So the preview calls:

```ts
buildWeekPlan(state, goal, nextWeekAnchor, [], [])
```

Empty feedbacks and activities mean: no adaptive downgrade, no `actual` rows, no
`status: 'skipped'` flags. The preview states what the programme plans, which is
what the card claims. The current week keeps its full adaptive behaviour — this
section does not change it.

`state` is still the real training state, so the fitness clamp on the long run
(`longest recent run + 2 km`) applies. That is a fact about the athlete, not a
reaction to a single day, and it must not be bypassed.

## Contract

`GET /api/plan/week` gains one field. Existing fields unchanged.

```jsonc
{
  "week": [ /* Mon–Sun, as today */ ],
  "weekMeta": { "currentWeek": 4, "totalWeeks": 14 },
  "goal": { /* unchanged */ },
  "programme": { /* this week, unchanged */ },
  "nextWeek": {
    "week": [
      {
        "day": "Mon",
        "date": "2026-11-02",
        "isToday": false,
        "programmeRole": "quality session",
        "workout": { "type": "tempo", "label": "TEMPO", "distance_km": 7, "status": "planned" }
      }
      // … 7 entries, no `actual`, no `status: "today" | "adapted" | "skipped"`
    ],
    "weekMeta": { "currentWeek": 5, "totalWeeks": 14 },
    "programme": { "phase": "build", "weeks_out": 9, "cutback": false, "taper": false,
                   "long_run_km": 13, "long_run_target_km": 13, "notes": [] }
  }
}
```

`nextWeek` is `null` when there is nothing honest to show:

- `goal.goal_date` is before the next week's Monday (the race has happened).
- The athlete has no goal and no activities yet — the engine would be inventing a
  programme from nothing.

## Implementation

### 1. Server — build the second week

`server/src/modules/training/application/plan.service.ts`

```ts
// Next Monday, computed from date parts: adding 7 * 86400000 ms crosses DST as
// 23:00 the previous day in most European zones, which would shift the whole
// week back one day.
function nextWeekAnchor(from: Date): Date {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + 7)
  return d
}
```

Inside `planWeek()`, after the current week and its roles:

```ts
const anchor = nextWeekAnchor(today)
const nextWeekMeta = getWeekMeta(activities, goal, athlete, anchor)
const nextDays = buildWeekPlan(state, goal, anchor, [], [])
const out = weeksOut(goal?.goal_date, anchor)
for (const day of nextDays) {
  day.programmeRole = day.workout.type === 'rest' ? null : dayRole(archetype, out, day.workout.type)
  day.isToday = false            // the anchor is the same weekday next week
  day.workout.status = 'planned'
}
```

Return `nextWeek: { week: nextDays, weekMeta: nextWeekMeta, programme: nextDays.programme }`
or `null` per the guard above. `nextDays.programme` exists because `buildWeekPlan`
attaches it with `Object.assign`.

No change to `buildWeekPlan` itself — no new parameter, no behaviour change for
the current week.

### 2. Server — route and types

`plan.routes.ts` `/week` handler: destructure `nextWeek` and include it in the
response. `WeekPlan` in `plan.service.ts` gains:

```ts
nextWeek: { week: WeekDay[]; weekMeta: { currentWeek: number; totalWeeks: number }; programme: unknown } | null
```

The `/today` route does not touch it.

### 3. Client — DTOs

- `client/src/modules/training/infrastructure/dto/PlanNextWeek.ts` (new):
  `{ week?: PlanDay[] | null; weekMeta?: WeekMetaPrimitives | null; programme?: PlanProgramme | null }`.
- `PlanWeekResponse` gains `nextWeek?: PlanNextWeek | null`.

One concept, one file, per the module rules.

### 4. Client — derive the cards

`TrainingPlanView.vue`

Delete `previewCards`. Replace with a computed over `nextWeek`:

```ts
const PREVIEW_LIMIT = 3

const previewCards = computed(() => {
  const days = nextWeek.value?.week ?? []
  const sessions = days.filter((d) => d.workout?.type && d.workout.type !== 'rest')
  const rank = (t: string) => (t === 'long' ? 0 : HARD.has(t) ? 1 : 2)
  return [...sessions]
    .sort((a, b) => rank(a.workout!.type!) - rank(b.workout!.type!) || String(a.date).localeCompare(String(b.date)))
    .slice(0, PREVIEW_LIMIT)
    .map((d) => ({
      badgeKey: badgeKeyFor(d.workout!.type!),
      titleKey: workoutLabelKey(d.workout!.type!),
      descKey: purposeKeyFor(d.workout!.type!),
      distance: formatPlanDistance(d.workout!.distance_km),
      date: d.date,
    }))
})
```

- `rank` puts the long run first (the session the week is built around), then
  quality, then easy — stable regardless of which weekday holds each.
- No `HARD` set duplicated on the client: reuse `WorkoutType` and a small
  `isQuality(type)` helper added next to `workoutBadge()` in
  `modules/shared/ui/training-vocabulary.ts`.
- `week-number` becomes `nextWeek?.weekMeta?.currentWeek ?? nextWeekNumber`.

`NextWeekPreview.vue`

- `items` becomes required (`required: true`, no default array). Delete the
  three placeholder cards.
- Card gains the date, rendered under the badge via `Intl.DateTimeFormat` with
  the active locale, so "Mon 2 Nov" matches the schedule above it.
- Keep badge / title / desc / distance layout and `rounded-2xl` geometry.
- The section is rendered with `v-if="previewCards.length"`, so an absent
  `nextWeek` removes the heading too.

### 5. i18n

New keys, both catalogues (`pt` and `en`):

| Key | en | pt |
| --- | --- | --- |
| `ui.purpose_easy` | Easy aerobic run to build the base without fatigue. | Corrida fácil aeróbica para construir a base sem fadiga. |
| `ui.purpose_recovery` | Very easy running to restore circulation. | Corrida muito leve para restaurar a circulação. |
| `ui.purpose_long` | The week's long run, building endurance. | A corrida longa da semana, a construir resistência. |
| `ui.purpose_steady` | Sustained aerobic effort. | Esforço aeróbico sustentado. |
| `ui.purpose_tempo` | Comfortably hard running at tempo effort. | Corrida confortavelmente intensa em esforço tempo. |
| `ui.purpose_threshold` | Threshold work to raise the pace you can hold. | Trabalho de limiar para subir o ritmo que consegues manter. |
| `ui.purpose_interval` | Short fast repetitions with recoveries. | Repetições curtas e rápidas com recuperações. |

Reuse `ui.type_*` for titles and `ui.badge.*` for badges — they already exist and
already translate.

Delete the now-dead keys from both files (9 each): `preview_title_aerobic_capacity`,
`preview_desc_aerobic_capacity`, `preview_title_lactate_threshold`,
`preview_desc_tempo_block`, `preview_title_endurance_building`,
`preview_desc_endurance_run`, `preview_badge_intervals`, `preview_badge_tempo`,
`preview_badge_long`.

### 6. Accessibility

- The section keeps a real heading (`ui.next_week_preview` with the week number),
  so it stays a labelled region even when only three cards render.
- Each card's distance already reads as text; the badge is a `<span>`, not an
  image, so no `alt` is required. Ensure the badge is not the only carrier of
  meaning — the title repeats it.
- Dates use the active locale's formatter and are not abbreviated to numbers that
  could be read as distances.
- Keep `ui.estimated`: the card is a programme projection, and that word is the
  honest label.

### 7. Sequencing with localisation

`programmeRole` and the new purpose copy are catalogue strings, so this plan is
independent of `docs/plans/ai-localisation.md`. If that plan ships first, the
preview's `programmeRole` values arrive as keys and must not be rendered raw —
either the preview renders only badge/title/purpose/date, or it waits for the
role key mapping. Simplest: the preview does not render `programmeRole` at all;
the purpose string already says what the session is for.

## Tests

Server (`server/tests/unit/plan.service.test.ts` or a new
`next-week.test.ts`):

| Assertion |
| --- |
| `nextWeek.week` has 7 entries whose dates are exactly the current week's dates + 7 |
| no entry has `isToday === true`, no `actual`, no `status` other than `planned` |
| the long run distance respects the fitness clamp (same value the current week's programme would produce for that phase) |
| `nextWeek.programme.phase` matches the archetype at that weeks-out value, including a cutback week |
| a goal date inside the current week returns `nextWeek: null` |
| an athlete with no goal and no activities returns `nextWeek: null` |
| feedback dated today does not downgrade a next-week session (pass a high-RPE or skipped row and assert the type is unchanged) |

Client (`client/src/features/training-plan/__tests__/preview.test.ts`, Vitest):

| Assertion |
| --- |
| long run is first, then quality by date, capped at three |
| rest days never appear |
| `nextWeek: null` renders no section |
| distances come from `distance_km` and format through `formatPlanDistance` |

## Verification

```bash
npm test --prefix server
npm run typecheck --prefix server
npm test --prefix client
npm run typecheck --prefix client
npm run lint --prefix client
npx playwright test          # a11y spec still passes with the section mounted
```

Manual: log in as an athlete whose goal is 6 weeks out, open the plan, and compare
the preview's long-run distance with the `programme.long_run_target_km` the same
response reports for next week. They must agree. Then move the goal date into the
past and confirm the section disappears.

## Rollout and rollback

Additive: an older client ignores `nextWeek`; a newer client ignores its absence.
No migration, no cache invalidation. Rollback is deleting the client computed and
restoring the constant — but do not restore the fake distances; hide the section
instead.

## Risks

| Risk | Mitigation |
| --- | --- |
| Preview disagrees with the real week when the athlete reaches it (programme recalculated seven days later with more activity history) | Expected and labelled "estimated"; the fitness clamp is the only input that can move it, and it moves in the safe direction |
| Empty preview on general-fitness athletes with no runs | Return `null` rather than a template week; hiding is honest |
| DST shifting the anchor | Anchor computed from date parts, not milliseconds |
| Duplicate card logic drifting from the schedule grid | Both read the same `nextWeek.week`; the grid formats with `formatPlanDistance` too |
| Goal date inside the next week | Guard on `goal_date < anchor` is not enough — use "anchor Monday is after the goal date" and add the test |

## Out of scope

- AI explanations for next week (`/api/plan/ai/week` stays current-week only).
- Editing or replanning next week from the preview.
- A seven-day mini strip, week volume total, or a link into a future week view.
- Persisting next week across requests; it is derived per call and cheap.

## Implementation notes (2026-10-24)

Shipped, with two shape changes from the sketch:

- The week is built by an exported pure function `buildPreviewWeek(state, goal,
  today)` in `plan.service.ts`, not inline in `planWeek`. `nextWeek` is assembled
  there from that week plus `getWeekMeta(activities, goal, athlete, anchor)`.
  This is what makes the "goal already passed" and "no actuals" rules testable
  without Mongo.
- `previewSessions()` lives in `features/training-plan/preview-sessions.ts` as a
  pure selector (no `@vue/test-utils` in this repo), and the view maps its output
  to catalogue keys with `workoutBadgeKey` / `workoutLabelKey` /
  `workoutPurposeKey`, so the template stays reactive on a language switch.
- The role label above each session still comes from `programmeRole` +
  `programmeRoleParams` (implemented in the localisation plan), and the preview
  cards themselves do not render it — badge, title, purpose, date and distance.

The selection rule is exercised by `preview-sessions.test.ts` (long first, quality
by date, cap 3, no rest days, no quality fallback to easy) and the server rules by
`next-week-preview.test.ts` (dates +7, no `isToday`/`actual`, role keys, goal
guards).
