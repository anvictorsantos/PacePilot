# Implementation plan — coach to many athletes

Status: ready for delivery
Design: `docs/plans/coach-athlete-relationship.md` (accepted, decisions 1–5)
Scope: server-first slices, then client; no schema-breaking change, no new dependency.

## What ships

A coach account can invite an athlete, see the roster, read the athlete's
deterministic week/progress/activities/feedback, edit the athlete's goal, trigger
a sync and write dated coach notes. An athlete holds at most one coach and can
leave. Reassignment is confirm-and-replace (policy C).

Locked decisions: `Coach` in code, "trainer"/"treinador" in copy; every account is
an athlete and some also carry the `coach` role; coach writes are goal + note +
sync only; invite TTL is 24h; replacement needs `confirmReplace` +
`expectedCoachId`.

## Delivery rules

- One slice per PR. Each slice leaves `main` deployable and existing athlete
  routes byte-compatible.
- Server lands before the client that calls it. The client never ships against a
  route that does not exist in production.
- No feature flag. The natural gate is the `coach` role: coach routes answer 403
  for every existing account until an operator grants the role.
- No new dependency. Reuse `zod`, `mongoose`, the email sender, `useResource`,
  `useDialog`, `useToast`.
- Every new endpoint gets validation, authorization, 503 without DB, a client
  consumer and a test before the slice closes.
- Migrations are idempotent and rerunnable; the second run writes zero rows.

## Definition of done

- Every acceptance criterion in the design doc is demonstrable.
- `npm run typecheck` and `npm test` pass in both workspaces; client
  `lint`, `format:check`, `build` pass; server boot smoke and esbuild bundle pass.
- `npm audit --audit-level=high` is clean in both workspaces.
- Migration dry-run + rerun reported; index list matches the design.
- `CONTEXT.md`, `CLAUDE.md`, `README.md` describe the shipped behaviour.
- No provider token, invite token, email or note body appears in a log or a
  response where it should not.
- A coach cannot read or write a foreign athlete; a non-coach gets 403; a
  signed-out caller gets 401; DB-down data routes get 503.

## Slices

| Slice | PR | Size | Depends on | Ships |
| --- | --- | --- | --- | --- |
| S0 | contracts | S | — | Types, role value object, DTO fields, docs index |
| S1 | persistence + migration | M | S0 | `roles`/`coach` fields, `CoachInvite`, `CoachNote`, indexes, grant-role script |
| S2 | session + gates | M | S1 | `roles` on the session, `requireCoach`, `resolveCoachSubject` |
| S3 | invites + link lifecycle | L | S2 | Invite CRUD, 24h token, email, accept/confirm, unlink/leave |
| S4 | coach read API | L | S3 | Roster + week/today/progress/activities/feedback |
| S5 | coach write API | L | S4 | Goal, sync, notes; `coachNote` on plan reads |
| S6 | client module + roster | L | S5 | `modules/coaching`, `/coach` roster, invite dialog |
| S7 | athlete detail + join | L | S6 | `/coach/athletes/:id`, `/join`, note display/editor |
| S8 | role-aware shell | M | S7 | Nav, guard, settings cards, i18n, a11y |
| S9 | hardening + docs | M | S8 | Erasure, observability, glossary, release checks |

```text
S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9
```

S3 may start once S2 is merged; S4 and S5 can be reviewed in parallel if the
route file is split per concern, but S5 must not merge before S4's subject helper
is stable.

## S0 — contracts

Goal: make the new vocabulary compile without changing behaviour.

Files:

- `server/src/modules/athlete/domain/AccountRole.ts` — `'athlete' | 'coach'`,
  `isCoach(roles)`, `normaliseRoles(value)`.
- `server/src/modules/coaching/domain/CoachLink.ts` — pure invariants (self-link,
  current/expected coach, replacement allowed).
- `server/src/modules/coaching/domain/CoachNote.ts` — date + body validation.
- `client/src/modules/account/domain/value-object/AccountRole.ts` — mirror enum.
- `client/src/modules/auth/infrastructure/dto/AuthSessionResponse.ts` and
  `client/src/modules/account/infrastructure/dto/CurrentUser.ts` — optional
  `roles`, `coach`.
- `docs/plans/coach-athlete-implementation.md` — this file; add it to the docs
  index.

Tasks:

- No route, schema or screen change.
- Keep every new field optional on the client DTOs so old fixtures pass.
- Add a tiny unit test for `isCoach` / `normaliseRoles`.

Acceptance: both workspaces typecheck; existing tests unchanged and green.

## S1 — persistence, indexes, operator script

Goal: store the relationship without exposing it yet.

Files:

- `server/src/modules/athlete/infrastructure/persistence/Athlete.ts` — `roles`,
  `coach`, `previousCoach`, `coachLinkedAt`, `coachUnlinkedAt`; `{ coach: 1 }`
  index.
- `server/src/modules/coaching/infrastructure/persistence/CoachInvite.ts` — new
  model + indexes (unique `tokenHash`, pending partial unique `{coach,email}`,
  list index).
- `server/src/modules/coaching/infrastructure/persistence/CoachNote.ts` — new
  model + unique `{coach,athlete,date}` and read index `{athlete,date}`.
- `server/scripts/migrate-coach-roles.mjs` — backfill `roles: ['athlete']` where
  missing; `--dry-run`; prints counts; creates indexes by calling
  `Athlete.createIndexes()`, `CoachInvite.createIndexes()`,
  `CoachNote.createIndexes()`.
- `server/scripts/grant-coach-role.mjs` — `--email`, `--revoke`, `--dry-run`;
  revoke refuses while the account still has athletes.
- `server/package.json` — `db:migrate-coach-roles`, `coach:grant`.
- `server/scripts/ensure-indexes.mjs` — include the two new models.

Tasks:

- `roles` defaults to `['athlete']`; a validator rejects an array without
  `'athlete'`.
- `coach` starts `null`; `previousCoach` starts `null`.
- Migration is report-only for existing rows; no activity/feedback movement.

Tests:

- `server/tests/unit/coach-link.test.ts` — invariants (no DB).
- Migration dry-run on a local copy; second run zero writes.

Acceptance: a new account is `['athlete']` with `coach: null`; the operator can
grant/revoke a role; indexes match the design; rerun writes zero rows.

## S2 — session roles, coach gate, subject resolver

Goal: the server knows who is a coach and can authorize a subject athlete.

Files:

- `server/src/modules/athlete/application/session.service.ts` — projection keeps
  `roles`/`coach`; `resolveSession` unchanged otherwise.
- `server/src/modules/auth/application/auth.service.ts` — `PublicUser` gains
  `roles`; `publicUser` maps them with the `['athlete']` fallback.
- `server/src/modules/auth/infrastructure/routes/auth.routes.ts` —
  `sessionResponse` returns `roles` and a coach summary (`coachSummary()` reusable).
- `server/src/modules/shared/infrastructure/http/coachAuth.ts` — `requireCoach`.
- `server/src/modules/coaching/application/coach-subject.service.ts` —
  `resolveCoachSubject(req, athleteId)` returning the subject session.
- `server/src/modules/training/application/plan.service.ts` — widen
  `loadTrainingData` input to `Pick<AthleteSession, 'athlete' | 'athleteId'>`.

Tasks:

- `requireCoach`: 401 signed out, 403 `coach_required`, 503 when the DB is down.
- `resolveCoachSubject`: invalid/foreign/unassigned id → 404; never a 403 that
  reveals existence.
- `GET /api/me` gains `roles` and `coach`; no other athlete route changes.

Tests:

- `server/tests/unit/coach-auth.test.ts` — 401/403/404/503; coach who is also an
  athlete keeps own routes.
- `server/tests/unit/session.service.test.ts` — role/coach projection survives
  the lean select and the token path.

Acceptance: existing athlete payloads are byte-compatible apart from the
additive `roles`/`coach`; coach gate works; no route mounted yet.

## S3 — invite lifecycle, email, link/unlink

Goal: a coach can invite and an athlete can accept, replace or leave.

Files:

- `server/src/modules/coaching/domain/CoachInviteToken.ts` — reuse
  `auth/domain/email-token.ts` helpers with `24 * 3600 * 1000`.
- `server/src/modules/coaching/application/coach-invite.service.ts` — create,
  list, revoke, preview, accept.
- `server/src/modules/coaching/application/coach-link.service.ts` — unlink by
  coach, leave by athlete.
- `server/src/modules/coaching/infrastructure/schemas/coach-invite.ts` — Zod for
  email, token, `confirmReplace`, `expectedCoachId`.
- `server/src/modules/coaching/infrastructure/routes/coach.routes.ts` — invite
  routes only.
- `server/src/modules/auth/infrastructure/schemas/auth.ts` — optional
  `inviteToken` on register.
- `server/src/modules/auth/application/auth.service.ts` — after account create,
  link when `inviteToken` is valid; keep the current response shape.
- `server/src/modules/auth/infrastructure/email/templates.ts` +
  `application/email.service.ts` — `coach_invite` kind, en + pt, 24h copy.
- `server/src/modules/athlete/infrastructure/routes/me.routes.ts` —
  `DELETE /api/me/coach`.
- `server/src/app.ts` — mount `/api/coach`; invite email limiter.

Tasks:

- Implement policy C exactly as the design algorithm: null link, same-coach
  idempotent, other-coach 409 with summary, confirmed conditional replace,
  `coach_changed` on a moved link.
- Rate-limit `POST /api/coach/invites` (10/15 min/IP).
- Invite preview returns coach identity + expiry only.
- No email enumeration from the invite creation response.
- On unlink/leave set `coach: null`, `previousCoach`, `coachUnlinkedAt`; keep
  activities, feedback, goals and notes.

Tests:

- `server/tests/unit/coach-invite.test.ts` — TTL, hash, single-use, email
  mismatch, self-link, `already_assigned`, confirmed replace, `coach_changed`,
  concurrent accepts.
- `server/tests/unit/coach-auth.test.ts` — invite owner scoping.

Acceptance: invite → accept → roster link works; replacement needs confirmation;
revoke/expire/unlink/leave behave; register with a valid invite links in one
step.

## S4 — coach read API

Goal: the coach sees the same deterministic training truth as the athlete.

Files:

- `server/src/modules/coaching/application/coach-roster.service.ts` — bounded
  aggregation (`$match`, `$sort`, `$skip`, `$limit`, `$lookup` last activity and
  7-day volume).
- `server/src/modules/coaching/infrastructure/schemas/roster-query.ts` —
  `page`, `per_page` capped at 50.
- `server/src/modules/coaching/infrastructure/routes/coach.routes.ts` — read
  routes.
- `server/src/modules/activities/infrastructure/routes/activities.routes.ts` —
  export the sanitizer/query helper if needed; do not fork it.

Tasks:

- Reuse `planWeek`, `planToday`, `buildProgress`, the activity sanitizer and the
  latest-20 feedback query with the subject session.
- Activity detail verifies `activity.athlete === subject.id`; no provider
  enrichment and no credential load.
- Roster returns no email.
- Return 404 for a foreign athlete id; 503 when the DB is down.

Tests:

- `server/tests/unit/coach-roster.test.ts` — aggregation shape, bound, no email.
- `server/tests/unit/coach-auth.test.ts` — read matrix per route.

Acceptance: response fixtures for a given athlete match the athlete routes;
roster paginates; foreign/unknown/unassigned all 404.

## S5 — coach writes and notes on the plan

Goal: the coach changes inputs, never the prescription.

Files:

- `server/src/modules/coaching/application/coach-goal.service.ts` — reuse
  `goalSchema`, set `goalSetAt`, clear the athlete AI cache.
- `server/src/modules/coaching/application/coach-sync.service.ts` — reuse
  `activity-import.service` with the athlete's `Connection`; keep
  `guarded`/`truncated`.
- `server/src/modules/coaching/application/coach-note.service.ts` — list, upsert,
  delete; author must be linked.
- `server/src/modules/coaching/infrastructure/schemas/coach-note.ts` — local
  `YYYY-MM-DD`, body 1..500.
- `server/src/modules/coaching/infrastructure/routes/coach.routes.ts` — write
  routes.
- `server/src/modules/training/application/plan.service.ts` — attach `coachNote`
  to week days and today with one query per read.
- `server/src/app.ts` — coach sync write limiter keyed `coachId:athleteId`.

Tasks:

- `PUT .../goals` mirrors `PUT /api/goals` and returns the goal; it never accepts
  a workout override.
- `POST .../sync` uses the athlete's connection, never returns a token, and
  reports the existing `SyncResult`.
- Notes are plain text, display-only, ignored by the engine and the v1 AI prompt.
- `GET /api/plan/week` day gains `coachNote`; `GET /api/plan/today` gains
  `coachNote` (additive).

Tests:

- `server/tests/unit/coach-note.test.ts` — date/body, author scoping, one note
  per coach/athlete/date, engine output unchanged.
- `server/tests/unit/plan.service.test.ts` — `coachNote` attachment without a
  shape break.
- `server/tests/unit/coach-sync.test.ts` — guarded/truncated passthrough and no
  token in the response.

Acceptance: goal write re-anchors the week and clears AI cache; sync returns the
known shape; notes appear on both coach and athlete reads; no route writes
`WorkoutFeedback`, workout type, distance or date.

## S6 — client coaching module + roster

Goal: a coach can sign in, see the roster and invite an athlete.

Files:

- `client/src/modules/coaching/domain/repository/CoachRosterRepository.ts` —
  port.
- `client/src/modules/coaching/application/use-case/{LoadRoster,InviteAthlete,
  RevokeInvite,AcceptInvite,UnlinkAthlete,LeaveCoach}.ts`.
- `client/src/modules/coaching/infrastructure/http/CoachApiRepository.ts`.
- `client/src/modules/coaching/infrastructure/dto/{CoachAthleteSummary,
  CoachRosterResponse,CoachInvite,CoachAssignConflict,CoachPreview}.ts`.
- `client/src/modules/coaching/infrastructure/composable/{useCoachRoster,
  useCoachInvites}.ts`.
- `client/src/modules/coaching/infrastructure/container/coaching-container.ts`.
- `client/src/modules/shared/infrastructure/http/client.ts` — `ROUTES.coach*`
  and `api.coach.*`.
- `client/src/modules/shared/infrastructure/resource-keys.ts` — `coachRoster`,
  `coachInvites`.
- `client/src/features/coach/views/CoachRosterView.vue`.
- `client/src/features/coach/components/{AthleteRosterCard,InviteAthleteDialog}.vue`.
- `client/src/router/index.ts` — `/coach` with `meta.requiresRole: 'coach'`.
- `client/src/i18n/{pt,en}.json` — roster + invite keys.

Tasks:

- Loading, empty, error/retry and success states.
- Invite dialog through `useDialog`; labelled input; `aria-describedby` error;
  `role="status"` success; disabled/submitting state.
- Roster card is responsive, not a desktop-only table.
- `AcceptInvite` exposes the 409 conflict shape for S7.

Acceptance: coach can invite and revoke; roster lists only their athletes; a
non-coach hitting `/coach` is redirected; axe/keyboard checks pass on the roster.

## S7 — athlete detail, join flow, note display

Goal: the coach can act on one athlete; the invited athlete can join and see the
coach's note.

Files:

- `client/src/features/coach/views/CoachAthleteView.vue`.
- `client/src/features/coach/components/{AthleteHeader,EditGoalDialog,
  SyncAction,CoachNoteEditor,FeedbackList}.vue`.
- `client/src/features/join/views/JoinView.vue`.
- `client/src/modules/coaching/application/use-case/{SaveAthleteGoal,
  SaveCoachNote,SyncAthlete}.ts`.
- `client/src/modules/coaching/infrastructure/composable/useCoachAthlete.ts`.
- `client/src/modules/coaching/infrastructure/dto/CoachNote.ts`.
- `client/src/features/today/views/TodayWorkoutView.vue` and
  `client/src/features/training-plan/components/WeeklyScheduleGrid.vue` — render
  `coachNote` when present.
- `client/src/router/index.ts` — `/coach/athletes/:id`, `/join` public.
- i18n — goal, sync, note, join, conflict keys.

Tasks:

- Detail sections: week, progress, activities, feedback; reuse the presentational
  components via props; per-section loading/empty/error.
- Goal editor uses the same fields and validation as `GoalsView`.
- Sync action shows the existing success/guarded/error toasts.
- Coach note editor writes one note per date; the athlete sees it on today/plan.
- Join flow: preview → register or sign in → accept → redirect `/workout`.
  On 409 show the current coach and “Leave A and join B?”; confirm sends
  `confirmReplace` + `expectedCoachId`; `coach_changed` re-renders the conflict.
- Empty/expired/mismatch/self-link states are explicit, not generic errors.

Acceptance: end-to-end coach invite → athlete join → coach sees athlete → goal
edit → sync → note → athlete sees note → unlink.

## S8 — role-aware shell, settings, a11y

Goal: the product feels intentional for both roles without branching every view.

Files:

- `client/src/modules/auth/infrastructure/composable/useAuth.ts` — `roles`,
  `isCoach`, `coach`.
- `client/src/main.ts` — guard `requiresRole`, default landing per role.
- `client/src/layouts/{AppSidebar,MobileMenu,UserMenu}.vue` — coaching group only
  when `isCoach`; training group stays for everyone.
- `client/src/features/settings/views/SettingsView.vue` — “Your coach” card
  (athlete) and invite management (coach).
- i18n — `shell.athletes`, role labels, settings cards.
- `client/src/components/icons/` — reuse existing icons; add only if a needed
  glyph is missing.

Tasks:

- A coach lands on `/coach`; an athlete on `/workout`.
- A coach keeps access to their own training pages.
- Settings unlink/leave uses the same confirm pattern as the rest of the app.
- Focus order, 44px targets, `aria-current`, labels and contrast hold on both
  shells.

Acceptance: no athlete sees a coach affordance; no coach loses their training
nav; direct URL access is guarded; a11y spec passes with a session fixture.

## S9 — hardening, docs, release

Goal: safe deletion, honest logs and a release that can be rolled back.

Files:

- `server/src/modules/athlete/infrastructure/routes/me.routes.ts` — erasure
  detaches athletes, deletes invites/notes in the same transaction; keep
  `{ ok, deleted, atomic }`.
- `server/src/modules/coaching/application/*` — lifecycle logs (ids only, no
  email/token/note body).
- `CONTEXT.md` — Coach, Athlete, Coach Link, Coach Invite, Coach Note, Roster.
- `CLAUDE.md` — coaching module, role gate, coach namespace, new contracts.
- `README.md` — endpoint inventory and coach write scope.
- `docs/plans/coach-athlete-relationship.md` — mark implemented; link this file.

Tasks:

- Verify coach deletion detaches every athlete and removes invites/notes; verify
  athlete deletion removes roster/invites/notes.
- Confirm no cache invalidation gap after unlink/leave.
- Run the release gate below on a copy of production data.

Acceptance: erasure is all-or-nothing where transactions exist and reports the
fallback honestly; docs match routes; release gate is green.

## Test matrix

| Layer | Cases |
| --- | --- |
| Domain | role parsing, link invariants, invite TTL/hash, note validation |
| Service | accept/replace/race, unlink/leave, goal write + AI cache, note scoping |
| HTTP | 400/401/403/404/409/410/503 per route; foreign athlete 404; no email in roster |
| Regression | existing `GET /api/plan/*`, `/api/progress`, `/api/activities*`, `/api/goals`, `/api/me` fixtures unchanged except additive fields |
| Client unit | use cases, cache invalidation, guard, conflict state |
| Client a11y | roster, invite dialog, join conflict, note editor |
| Migration | dry run, rerun, count parity, index list |

## Release order

1. Merge S0–S2. Deploy server. No behaviour change; roles default to athlete.
2. Run `npm run db:migrate-coach-roles --prefix server -- --dry-run`, then for
   real; run `npm run db:indexes --prefix server`.
3. Merge S3–S5. Deploy server. Coach routes exist but only a granted coach can
   call them.
4. Grant the pilot coach: `npm run coach:grant --prefix server -- --email <coach>`.
5. Merge S6–S9. Deploy client.
6. Invite the pilot athletes. Watch Sentry for 5xx and the new lifecycle logs.
7. Only then widen the coach cohort.

No feature flag is required: before step 4, every account has
`roles: ['athlete']` and every coach route answers 403.

## Rollback

- Client revert is safe: the athlete surface does not depend on coach fields.
- Server revert is safe: `roles`/`coach`/invites/notes are additive and ignored
  by the reverted code. Revoke the pilot coach role if needed.
- Do not drop coach collections or fields during rollback; leave them for the
  next deploy.
- If a bad invite link is suspected: revoke pending invites, bump the invite
  token table (delete pending rows) and re-invite. Existing links are unaffected.
- If a coach must be removed immediately: `coach:grant -- --email <coach>
  --revoke` requires no linked athletes; otherwise unlink each athlete first or
  delete the coach account (detaches all).

## Risks to watch during delivery

| Risk | Check |
| --- | --- |
| Scope creep into plan overrides | PR review rejects any write to workout type/distance/date or RPE |
| IDOR | Every new route calls `resolveCoachSubject`; test foreign ids |
| Invite race | Concurrent accept test; `expectedCoachId` conditional |
| Roster performance | Aggregation + bound; measure with a seeded cohort before launch |
| Stale client cache after unlink/replace | Invalidation test per use case |
| Old coach surprised by replacement | Accepted for v1; lifecycle log + follow-up notification |
| GDPR/health data exposure | Link is consent; athlete can leave in one action; roster omits email |
| Chunk budget | Coach views are lazy routes; no new dependency; `npm run build` gate |

## First PR (S0) checklist

- [ ] `AccountRole` + `isCoach` server and client.
- [ ] `CoachLink` invariants + unit test.
- [ ] Optional `roles`/`coach` on session/user DTOs.
- [ ] Docs index row for this plan.
- [ ] `npm run typecheck` both workspaces, `npm test` both.
- [ ] No route, schema or screen change.

