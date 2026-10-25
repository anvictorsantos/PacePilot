# Plan — one coach, many athletes (athlete holds at most one coach)

Status: proposed — decisions 1–4 accepted, reassignment policy open (§Reassignment)
Scope: `server/src/modules/{athlete,auth,coaching,training,providers,shared}/**`,
`server/src/app.ts`, `server/scripts/**`, `server/tests/unit/**`,
`client/src/modules/{account,auth,coaching,shared}/**`,
`client/src/features/{coach,join,settings,today,training-plan}/**`,
`client/src/layouts/**`, `client/src/router/index.ts`, `client/src/main.ts`,
`client/src/i18n/{pt,en}.json`, `CLAUDE.md`, `CONTEXT.md`, `README.md`

## Outcome

A **Coach** is an account that can follow and act on many **Athletes**. An
**Athlete** is linked to **zero or one** Coach. Every account can train, so a
Coach is also an Athlete and may hold a coach of their own. The relationship is
the only new concept: the deterministic training engine still owns the schedule.

- The coach gets a roster and a per-athlete view of the week, progress,
  activities and feedback.
- The coach writes **inputs**, never the prescription: the athlete's goal, a
  dated coach note, and a sync trigger. The engine still decides every workout
  type, distance and date.
- The athlete keeps ownership of RPE/feedback and the provider connection.
- Link and unlink are explicit, consented actions. No coach can browse, search
  or read an unassigned athlete.
- An athlete can leave a coach; a coach can detach an athlete. Neither action
  deletes training history.

### Acceptance criteria

- `Athlete.coach` is a single `ObjectId | null`. There is no way to persist a
  second coach for the same athlete; concurrent accepts yield exactly one link.
- A coach's roster lists every athlete whose `coach` points at them, paginated
  and bounded; it never lists another coach's athletes or unassigned athletes.
- A coach may also be an athlete: `roles` contains `'athlete'` for every
  account, and `'coach'` for coaches. A coach may be linked to a different coach,
  never to themselves.
- `GET /api/coach/athletes/:id/**` answers 404 for any athlete not linked to the
  requesting coach, 403 for a caller without the `coach` role, 401 signed out,
  503 with the database down.
- The existing athlete surface (`/api/plan/*`, `/api/progress`,
  `/api/activities*`, `/api/goals`, `/api/plan/feedback`, `/api/me`,
  `/api/providers/*`) keeps its exact request/response shapes and authorization.
  Coach writes live under `/api/coach/**`.
- Coach writes are limited to: the athlete's goal, a dated coach note, and a
  provider sync. A coach cannot write `WorkoutFeedback`, RPE, a workout type,
  distance or date.
- Coach-dated notes are additive on `GET /api/plan/week` (`week[i].coachNote`)
  and `GET /api/plan/today` (`coachNote`), display-only and ignored by the engine
  and the AI prompt in v1. The athlete sees what the coach wrote.
- `GET /api/auth/session` and `GET /api/me` gain additive fields only:
  `roles`, `coach`.
- The invite token is single-use, hashed at rest, expires after **24 hours**, and
  can only be accepted by the signed-in account that owns the invited email.
- Deleting a coach account detaches every assigned athlete, deletes its invites
  and its notes in the same erasure transaction; deleting an athlete removes
  them from the roster and cleans invite/note rows.
- All checks in §Verification pass, and no existing athlete view gains a role
  branch beyond the role-aware shell and the coach-note display.

## Absorbed current state (what actually exists)

### Identity

- The only account table is `Athlete`
  (`server/src/modules/athlete/infrastructure/persistence/Athlete.ts`). It holds
  identity (`email`, `password_hash`, `firstname`, `lastname`, `profile`,
  `timezone`), training state (`goal`, `goalSetAt`, `hr_zones`) and legacy
  provider fields.
- `session.service.ts` is the single answer to "who is this request":
  `extractToken` → `verifyToken` → `resolveSession` → `loadAthlete`. It caches
  the result per request under a symbol and exposes `session.athleteId`,
  `session.athlete`, `session.revoked`. Projection strips
  `access_token`, `refresh_token`, `password_hash`.
- The JWT carries `athleteId`, `tv` (token version) and legacy Strava claims.
  Revocation is `tokenVersion` comparison against the loaded row.
- `requireAuthForUserData` in `shared/infrastructure/http/auth.ts` only checks
  the presence of a usable session. There is **no role anywhere** in the server
  or the client.
- Account creation is `POST /api/auth/register` (email + password, unique
  partial index) and the Strava callback; both mint the same session cookie.

### Data scoping

Every data route derives the subject from the session and queries by it:

| Route | Subject derivation | Read/Write |
| --- | --- | --- |
| `GET /api/plan/{today,week}` | `planWeek(await getSession(req))` | read |
| `POST /api/plan/feedback` | `getSession(req).athleteId` → `WorkoutFeedback` | write |
| `GET /api/plan/feedback` | same, latest 20 | read |
| `GET /api/progress` | `loadTrainingData(await getSession(req))` | read |
| `GET /api/activities*` | `Activity.find({ athlete: athleteId })` + ownership check | read |
| `GET`/`PUT /api/goals` | `loadTrainingData(session)` / `findByIdAndUpdate(athleteId)` | read/write |
| `GET`/`DELETE /api/me` | `getSession(req)` | read/erase |

`loadTrainingData(session, opts)` reads `session.athleteId` and prefers the
already-loaded `session.athlete` row. `planWeek`, `planToday` and
`buildProgress` are pure derivations from that data, so a coach read can reuse
them unchanged if the subject session is swapped.

### Client

- `useAuth` reads `GET /api/auth/session` into one cached resource
  (`auth.session`) and exposes `authenticated`, `user`, `connections`,
  `emailVerified`, `ensure`.
- `router.beforeEach` gates every non-`meta.public` route on `ensure()` only.
- Navigation is a hardcoded list in `AppSidebar.vue` and `MobileMenu.vue`
  (`/workout`, `/plan`, `/progress`, `/activities`, `/goals`, `/settings`).
- `api` in `shared/infrastructure/http/client.ts` is the single path registry.
  `RESOURCE_KEYS` is the single set of cache keys.
- `WeeklyScheduleGrid`, `ProgressStatsGrid`, `ConsistencyCard`, the chart cards
  and `ActivityCard` are prop-driven presentational components and can be
  reused by a coach screen without reading athlete composables.

### Capacity and deletion

- `waitlist` capacity counts live provider connections against `ATHLETE_LIMIT`;
  it is unrelated to roles and needs no change.
- `DELETE /api/me` erases `Activity`, `WorkoutFeedback` and the `Athlete` row in
  one transaction, falling back to ordered deletes on standalone mongod. Coach
  deletion must join that same transaction.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Canonical term is **Coach** in code, domain and wire. UI copy says "trainer"/"treinador". | The product already names the explain layer `CoachInsight` and `coaching-*`; copy can use the local word. |
| D2 | Coach is an `Athlete` row with the `coach` role, not a separate collection. | Identity, password login, `tokenVersion`, erasure and every foreign key already point at `Athlete._id`. A second identity table would fork auth and GDPR deletion. |
| D3 | `Athlete.coach: ObjectId | null` scalar. N athletes = reverse query on that field. No join collection. | The requirement is "at most one coach"; a scalar enforces it at the storage layer. A join table would allow two rows and require an application invariant. |
| D4 | Link is invite-only. The coach invites an email; the athlete accepts while signed in as that email. | Prevents coach-side enumeration of the athlete base and makes the athlete's acceptance the consent record. |
| D5 | Invite token is random, stored as a hash, single-use, **24-hour TTL**. | Short window limits a forwarded link; mirrors the existing `email-token.ts` lifecycle; a database leak exposes no usable link. |
| D6 | Coach writes are **inputs**: the athlete's goal, a dated coach note, and a sync trigger. Never RPE/feedback, workout type, distance or date. | "Engine decides" is a product invariant. Goal and notes change what the engine plans; they do not let a human author a prescription. |
| D7 | Coach routes live under `/api/coach/**`, not `?athleteId=` on existing routes. | An explicit namespace makes the authorization boundary reviewable and leaves the athlete contract untouched. A query parameter on every route is an IDOR waiting to happen. |
| D8 | Subject authorization lives in one helper, `resolveCoachSubject(req, athleteId)`; every coach route calls it. | One place to prove "is this coach allowed to read/write this athlete". |
| D9 | Roles are read from the loaded `Athlete` row, never trusted from the JWT. | The session already loads the row once per request; a role change takes effect without re-issuing tokens. |
| D10 | `roles: ('athlete' | 'coach')[]`, always containing `'athlete'`; a coach may hold a different coach, never themselves. | Every account can train. A coach is a person with an extra capability, not a separate kind of user. |
| D11 | Reassignment policy is open — see §Reassignment. | Unlink-first, replace-on-accept and confirm-and-replace differ in consent UX and audit needs. |
| D12 | Coach activity detail reuses stored laps/streams and never calls the provider; only the explicit coach sync write uses the athlete's connection. | Provider tokens belong to the athlete; a passive coach read must not spend the athlete's quota. A deliberate sync is an explicit coach action. |

## Domain model

```text
Athlete (existing)                              CoachInvite (new)
┌────────────────────────────────────┐          ┌──────────────────────────────┐
│ _id                                │◄─────────│ coach       ObjectId          │
│ email                              │          │ email       string (lower)    │
│ roles: ['athlete'] | ['athlete','coach']      │ tokenHash   string (unique)   │
│ coach: ObjectId | null  ───────────┼──┐       │ status: pending|accepted|revoked│
│ coachLinkedAt: Date|null           │  │       │ expiresAt   Date (24h)         │
│ coachUnlinkedAt: Date|null         │  │       │ acceptedAt  Date|null          │
│ goal, goalSetAt, ... (as-is)       │  │       │ athlete     ObjectId|null      │
└────────────────────────────────────┘  │       └──────────────────────────────┘
        ▲                                 │
        └── N athletes point at ──────────┘ one coach

CoachNote (new)                    ┌──────────────────────────────────────────┐
┌──────────────────────────────┐   │ coach    ObjectId  (author)              │
│ athlete  ObjectId            │   │ athlete  ObjectId  (subject)             │
│ date     string (YYYY-MM-DD) │   │ body     string (max 500, plain text)    │
│ createdAt, updatedAt         │   └──────────────────────────────────────────┘
└──────────────────────────────┘
```

### `Athlete` additions

```ts
roles: {
  type: [String],
  enum: ['athlete', 'coach'],
  default: ['athlete'],
  validate: {
    validator: (v: string[]) => Array.isArray(v) && v.includes('athlete'),
    message: 'every account is an athlete',
  },
}
coach: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null }
coachLinkedAt: Date
coachUnlinkedAt: Date
```

Indexes:

- `{ coach: 1 }` — roster query and roster count (`roles` filter is cheap on the
  returned set; a compound `{ coach: 1, roles: 1 }` is multikey and unnecessary
  at this size).
- Existing `email` unique partial index is unchanged and is how an invite finds
  the account.

### `CoachInvite` document

```ts
{
  coach: ObjectId,                 // ref Athlete with 'coach' in roles
  email: string,                   // lowercase, trimmed, max 254
  tokenHash: string,               // sha256 of the emailed token
  status: 'pending' | 'accepted' | 'revoked',
  expiresAt: Date,                 // now + 24h
  acceptedAt: Date | null,
  athlete: ObjectId | null,        // set on accept
  createdAt, updatedAt
}
```

Indexes:

- `{ tokenHash: 1 }` unique.
- `{ coach: 1, status: 1, createdAt: -1 }` — coach's pending list.
- `{ coach: 1, email: 1 }` unique, `partialFilterExpression: { status: 'pending' }`
  — one live invite per coach/email; a revoked or accepted row does not block a
  new invite.

### `CoachNote` document

```ts
{
  coach: ObjectId,                 // author
  athlete: ObjectId,               // subject, must be linked at write time
  date: string,                    // local YYYY-MM-DD, validated
  body: string,                    // trimmed, 1..500 chars, plain text
  createdAt, updatedAt
}
```

Indexes:

- `{ athlete: 1, date: 1 }` — joining notes into the plan week read.
- `{ coach: 1, athlete: 1, date: 1 }` unique — one note per coach/athlete/date;
  a second write updates the note.

### Invariants (pure functions in `coaching/domain/`)

1. `athlete._id !== coach._id` — no self-link.
2. `coach.roles.includes('coach')` and the coach row exists.
3. `athlete.roles.includes('athlete')` — always true by schema validation.
4. Acceptance only when `athlete.coach` is null/absent, except the idempotent
   same-coach retry and the chosen reassignment policy.
5. An invite is pending, unexpired, and its `email` equals the signed-in
   account's normalised email.
6. A note is written only while the coach is linked to the athlete; unlink stops
   new notes. Existing notes are removed when either side is deleted, and are
   read-only to the athlete.
7. Unlink sets `coach: null`, `coachUnlinkedAt: now`; it never touches
   activities, feedback or goals.

## Authorization model

### Roles

| Caller | Own athlete routes | `/api/coach/**` |
| --- | --- | --- |
| unauthenticated | 401 | 401 |
| `roles: ['athlete']` | allowed | 403 `coach_required` |
| `roles: ['athlete','coach']` | allowed (their own training) | allowed only for linked athletes; foreign id → 404 |
| DB unavailable | 503 on data routes | 503 |

`isCoach(athlete)` is the only predicate. A coach who is also an athlete keeps
full access to their own `/api/plan/*` and `/api/progress` as before.

### `resolveCoachSubject`

```ts
// coaching/application/coach-subject.service.ts
async function resolveCoachSubject(
  req: Request,
  athleteId: string,
): Promise<{ coachId: string; athlete: AthleteDoc; athleteId: string }>
```

Rules:

- Resolve the session once via `getSession(req)`.
- If `session.athlete` has no `'coach'` role → `AppError` 403 `coach_required`.
- Validate `athleteId` as an ObjectId; invalid, missing, unassigned or foreign
  all produce **404 `not_found`** (non-enumerable).
- Query `Athlete.findOne({ _id: athleteId, coach: coachId })`.
- Build the subject session `{ payload: session.payload, athlete, athleteId,
  revoked: false }` and pass it to `planWeek` / `planToday` /
  `loadTrainingData` / the activities query.
- Never accepts an athlete id from a body on an existing athlete route.

`requireCoach` is a thin Express middleware that resolves the session, answers
401/403 and leaves `req.session` populated for the handler. Write routes call
`resolveCoachSubject` again through the same helper.

### Coach route inventory

All under `server/src/modules/coaching/infrastructure/routes/coach.routes.ts`,
mounted at `/api/coach` before `notFound`.

| Method | Path | Auth | Success | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/coach/athletes` | coach | `{ items, total, page, perPage }` | bounded `per_page` ≤ 50, default 20 |
| GET | `/api/coach/athletes/:id` | coach + linked | `{ athlete }` | summary header |
| GET | `/api/coach/athletes/:id/plan/week` | coach + linked | `PlanWeekResponse` | identical shape + `coachNote` per day |
| GET | `/api/coach/athletes/:id/plan/today` | coach + linked | `PlanTodayResponse` | identical shape + `coachNote` |
| GET | `/api/coach/athletes/:id/progress` | coach + linked | `ProgressResponse` | identical shape |
| GET | `/api/coach/athletes/:id/activities` | coach + linked | `ActivitiesResponse` | same pagination + type filter |
| GET | `/api/coach/athletes/:id/activities/:activityId` | coach + linked | `Activity` | verifies `activity.athlete === subject.id`; no provider enrichment |
| GET | `/api/coach/athletes/:id/feedback` | coach + linked | `PlanFeedback[]` | latest 20, same as athlete route |
| PUT | `/api/coach/athletes/:id/goals` | coach + linked | `Goal` | same Zod schema as `PUT /api/goals`; sets `goalSetAt`, clears athlete AI cache |
| POST | `/api/coach/athletes/:id/sync` | coach + linked | `SyncResult` | uses the athlete's connection; write limiter per coach+athlete |
| GET | `/api/coach/athletes/:id/notes` | coach + linked | `{ items }` | optional `from`/`to` date range |
| PUT | `/api/coach/athletes/:id/notes/:date` | coach + linked | `CoachNote` | `{ body }`, 1..500 chars, local date validated |
| DELETE | `/api/coach/athletes/:id/notes/:date` | coach + linked | `{ ok: true }` | author only |
| GET | `/api/coach/invites` | coach | `{ items }` | pending invites of the caller only |
| POST | `/api/coach/invites` | coach | `{ ok: true }` | `{ email }`; never reveals whether an account exists |
| DELETE | `/api/coach/invites/:id` | coach + owner | `{ ok: true }` | revoke pending invite |
| DELETE | `/api/coach/athletes/:id` | coach + linked | `{ ok: true }` | unlink; history and notes policy per §Reassignment |
| POST | `/api/coach/invites/accept` | session | `{ ok: true, coach }` | `{ token }`; email must match the session |
| GET | `/api/coach/invites/preview` | public | `{ coach, expiresAt }` | token bearer; no athlete data |

Athlete-side additions, minimal and additive:

| Method | Path | Auth | Change |
| --- | --- | --- | --- |
| GET | `/api/me` | session | `user` gains `roles` and `coach: { id, firstname, lastname, profile } \| null` |
| DELETE | `/api/me/coach` | session | athlete leaves the coach; `{ ok: true }` |
| POST | `/api/auth/register` | public | optional `inviteToken` in the body; links the new account when valid |
| GET | `/api/plan/week` | athlete | each day gains `coachNote: string \| null` (additive) |
| GET | `/api/plan/today` | athlete | gains `coachNote: string \| null` (additive) |

A coach viewing their own training sees their own notes only if they are also
linked to a coach; the note read is keyed on the **subject** athlete.

### Wire additions

`GET /api/auth/session` (additive, optional fields so old fixtures keep working):

```ts
{
  authenticated: true,
  user: { ... },
  roles: ('athlete' | 'coach')[],
  coach: { id, firstname, lastname, profile } | null,
  connections, strava, emailVerified   // unchanged
}
```

`GET /api/coach/athletes` item:

```ts
{
  id: string
  firstname: string | null
  lastname: string | null
  profile: string | null
  goal: { goal_type, goal_date } | null
  weekDistanceKm: number
  runs7: number
  lastActivityAt: string | null
  coachLinkedAt: string | null
}
```

No email in the roster. The coach already knows the email they invited; the
roster does not leak it to a second coach account.

### Error vocabulary

| Status | Code | When |
| --- | --- | --- |
| 400 | validation | Zod failure, invalid note date/body |
| 401 | `Not authenticated` | no usable session |
| 403 | `coach_required` | authenticated caller without the `coach` role |
| 403 | `invite_email_mismatch` | signed-in email differs from the invite email |
| 403 | `self_link` | a coach tries to accept their own invite |
| 404 | `not_found` | unknown/foreign athlete, unknown activity, unknown invite |
| 409 | `already_assigned` | athlete already linked to another coach and policy forbids replacement |
| 409 | `invite_used` | token already accepted/revoked |
| 410 | `invite_expired` | pending but past `expiresAt` (24h) |
| 503 | `unavailable` | database unreachable |

## Server architecture

```text
server/src/modules/
  athlete/
    domain/AccountRole.ts                 'athlete' | 'coach' + isCoach()
    infrastructure/persistence/Athlete.ts + roles, coach, coachLinkedAt, coachUnlinkedAt
    application/session.service.ts        loadAthlete projection includes roles + coach
    infrastructure/routes/me.routes.ts    roles + coach summary; leave-coach route
  coaching/
    domain/
      CoachLink.ts                        invariants above, pure
      CoachInviteToken.ts                 create / hash / 24h TTL (reuse email-token helpers)
      CoachNote.ts                        body/date validation
      errors.ts                           AlreadyAssigned, InviteExpired, InviteUsed, SelfLink
    application/
      coach-subject.service.ts            resolveCoachSubject + subject session
      coach-roster.service.ts             paginated aggregation + summary
      coach-invite.service.ts             create / list / revoke / preview / accept
      coach-link.service.ts               unlink by coach, leave by athlete
      coach-goal.service.ts               coach goal write + AI cache invalidation
      coach-note.service.ts               list / upsert / delete notes
      coach-sync.service.ts               athlete-connection sync on behalf of the coach
    infrastructure/
      persistence/CoachInvite.ts          mongoose model + indexes
      persistence/CoachNote.ts            mongoose model + indexes
      routes/coach.routes.ts              thin HTTP edge
      schemas/coach-invite.ts             Zod
      schemas/coach-note.ts               Zod (date, body)
      schemas/roster-query.ts             pagination + per_page bound
      email/coach-invite-email.ts         render + send through the existing sender
    shared/infrastructure/http/coachAuth.ts   requireCoach middleware
  auth/
    infrastructure/routes/auth.routes.ts  sessionResponse gains roles/coach
    application/auth.service.ts           publicUser gains roles; register accepts inviteToken
    infrastructure/schemas/auth.ts        optional inviteToken
    infrastructure/email/templates.ts     'coach_invite' copy in en + pt (24h)
    application/email.service.ts          sendCoachInviteEmail
  training/
    application/plan.service.ts           loadTrainingData accepts the subject shape;
                                          planWeek/planToday attach coachNote
```

Key implementation constraints:

- `loadTrainingData` takes `Pick<AthleteSession, 'athlete' | 'athleteId'>` (or is
  widened to a `TrainingSubject`), so `resolveCoachSubject` can pass its own
  subject without duplicating the load chain. `planWeek`/`planToday` keep their
  current signature; the subject session is structurally compatible.
- `planWeek`/`planToday` gain an optional note lookup by `{ athlete, date }` for
  the seven dates in the week. One query per read, not one per day. The coach
  routes reuse the same read, so the note appears on both sides.
- The roster aggregation is bounded and index-backed:
  `$match { coach, roles: 'athlete' }` → `$sort { createdAt: -1 }` → `$skip` →
  `$limit` → `$lookup` last activity and 7-day volume from `activities`
  (`{ athlete: 1, date: -1 }` already exists). No per-athlete loop.
- `CoachInviteToken` reuses the `auth/domain/email-token.ts` primitives
  (`createEmailToken`, `hashEmailToken`) with a 24h TTL, without importing auth
  application code.
- Invite email is sent through the existing `emailSender()` factory and
  `renderEmail`; delivery stays best-effort and the link is the only recoverable
  path. Tokens and links never reach logs.
- `POST /api/coach/invites` is rate-limited like the existing email limiter
  (10 per 15 min per IP) and uses the same `clientIpKey`.
- `POST /api/coach/athletes/:id/sync` reuses `activity-import.service` and the
  existing `guarded`/`truncated` response semantics; it needs the athlete's
  `Connection`, never returns a token, and gets its own write limiter keyed
  `${coachId}:${athleteId}`.
- `PUT /api/coach/athletes/:id/goals` reuses `goalSchema`, sets `goalSetAt`, and
  calls `clearAiCacheForAthlete(subjectId)` exactly like the athlete route.
- Coach notes are plain text (no HTML), max 500 chars, keyed by the local date
  string. The engine ignores them; the v1 AI prompt ignores them too.

### Accept algorithm

```text
1. hash token → find CoachInvite { tokenHash, status: 'pending' }
2. not found → 404
3. expiresAt <= now → mark 'revoked' → 410
4. load session athlete; normalise email; must equal invite.email → else 403
5. athlete._id === invite.coach → 403 self_link
6. role check: athlete.roles includes 'athlete' (always true)
7. conditional link per §Reassignment policy
8. mark invite 'accepted', acceptedAt, athlete → 200
```

Two concurrent accepts against the same athlete: one conditional update wins,
the other follows the chosen policy (409 or idempotent same-coach success).
The scalar field is the single source of truth.

### Deletion changes

`DELETE /api/me` erasure extends the existing transaction/fallback:

- Coach: `Athlete.updateMany({ coach: coachId }, { $set: { coach: null,
  coachUnlinkedAt: now } })`, `CoachInvite.deleteMany({ coach: coachId })`,
  `CoachNote.deleteMany({ coach: coachId })`, then delete the coach row.
- Athlete: existing activity/feedback deletion, plus
  `CoachInvite.deleteMany({ athlete: athleteId })`,
  `CoachNote.deleteMany({ athlete: athleteId })`, then delete the row.
- The response keeps `{ ok, deleted, atomic }`; `deleted` includes invite and
  note rows.

## Client architecture

```text
client/src/modules/
  account/
    domain/value-object/AccountRole.ts        'athlete' | 'coach' + parse
    infrastructure/dto/CurrentUser.ts         + roles, coach
    infrastructure/composable/useCurrentUser.ts unchanged shape, new fields
  auth/
    infrastructure/dto/AuthSessionResponse.ts + roles, coach
    infrastructure/composable/useAuth.ts      + roles, isCoach, coach computed
  coaching/
    domain/repository/CoachRosterRepository.ts   port: roster, athlete, invites, notes
    application/use-case/
      LoadRoster.ts
      InviteAthlete.ts
      RevokeInvite.ts
      AcceptInvite.ts
      UnlinkAthlete.ts
      LeaveCoach.ts
      SaveAthleteGoal.ts
      SaveCoachNote.ts
      SyncAthlete.ts
    infrastructure/
      http/CoachApiRepository.ts
      dto/CoachAthleteSummary.ts
      dto/CoachRosterResponse.ts
      dto/CoachInvite.ts
      dto/CoachNote.ts
      dto/CoachPreview.ts
      composable/useCoachRoster.ts
      composable/useCoachAthlete.ts     week/today/progress/activities/feedback
      composable/useCoachInvites.ts
      container/coaching-container.ts
      notification/ToastCoachNotifier.ts
```

### Routes and gate

- `/coach` → `features/coach/views/CoachRosterView.vue`
- `/coach/athletes/:id` → `features/coach/views/CoachAthleteView.vue`
- `/join` → `features/join/views/JoinView.vue`, `meta.public: true`
- Both `/coach*` routes carry `meta: { requiresRole: 'coach' }`.

`router.beforeEach` after `ensure()`:

```text
requiresRole === 'coach' && !isCoach → redirect '/workout'
authenticated && isCoach && to.path is the default landing → '/coach'
```

The login/`next` flow: a coach lands on `/coach`; an athlete on `/workout`.
`requiresRole` is a client hint only; the server enforces the same rule.

### Navigation

- `AppSidebar.vue` and `MobileMenu.vue` keep two hardcoded arrays:
  - training (everyone): Today, Plan, Progress, Runs, Goals, Settings
  - coaching (`isCoach` only): Athletes (`/coach`), placed above Settings
- A coach who also trains sees both groups. A coach sees their own training on
  the existing routes; no mode switch is needed.
- The user menu shows `shell.role.coach` when `isCoach`, otherwise
  `shell.role.athlete`.
- Athlete Settings gains a "Your coach" card: name, avatar, unlink action.
  Coach Settings gains an invite card: email field, pending invite list, revoke.

### Screens

`CoachRosterView`

- Header + count, search-free in v1.
- Responsive list of athlete cards (not a desktop-only table): avatar, name,
  goal type + date, last activity, 7-day distance, link state.
- States: loading skeleton, empty ("Invite your first athlete"), error with
  retry, success.
- Invite dialog through `useDialog` with labelled email input, `aria-describedby`
  error, disabled/submitting state, success announcement via `role="status"`.

`CoachAthleteView`

- Header: athlete identity, goal, linked since, edit-goal action, sync action,
  unlink action (confirm).
- Sections: Week (`WeeklyScheduleGrid` + coach-note editor), Progress
  (`ProgressStatsGrid`, `ConsistencyCard`, volume/pace charts, `FatigueCard`),
  Activities (list), Feedback (read-only list).
- Reuses the existing presentational components via props. If a component turns
  out to read an athlete composable directly, extract props first rather than
  copying the component.
- Loading/empty/error per section; a failed section does not blank the page.

`JoinView`

- Preview (coach name, 24h expiry) → register (new account, email fixed) or sign
  in (existing) → accept → redirect to `/workout` (the athlete now has a coach).
- States: invalid/expired token, email mismatch, already assigned, success.
- If the signed-in account already has the `coach` role, it still joins as an
  athlete under the inviting coach (unless self-link).

### State and invalidation

New keys in `RESOURCE_KEYS`:

```ts
coachRoster: 'coach.roster'
coachAthlete: (id: string) => `coach.athlete.${id}`
coachInvites: 'coach.invites'
coachNotes: (id: string) => `coach.notes.${id}`
```

- `AcceptInvite` invalidates `auth.session`, `coach.roster`, `account.current`.
- `SaveAthleteGoal` / `SyncAthlete` invalidate `coach.athlete.<id>` and
  `plan.*` for the subject, plus `progress.summary` for the subject.
- `SaveCoachNote` invalidates `coach.notes.<id>` and the subject's `plan.week` /
  `plan.today` reads.
- `UnlinkAthlete` / `LeaveCoach` invalidate `auth.session`, `coach.roster`,
  `coach.athlete.<id>` and every `coach.athlete.<id>.*` prefix read.
- `resetResourcePrefix` is the existing mechanism; no new cache layer.

### i18n

Every new string exists in both `pt.json` and `en.json`:

- `shell.athletes`, `shell.role.coach`, `shell.role.athlete`
- `coach.roster.*`, `coach.athlete.*`, `coach.goal.*`, `coach.note.*`,
  `coach.sync.*`, `coach.invite.*`, `coach.unlink.*`
- `join.*` (preview, new account, sign-in, success, expired, mismatch)
- `settings.coach.*`
- `ui.coach_note` (label on the athlete's plan/today)
- `errors.coach_required`, `errors.already_assigned`, `errors.invite_expired`,
  `errors.invite_used`, `errors.invite_email_mismatch`, `errors.self_link`
- Invite email copy says **24 hours** in both locales.

## Workstreams

### WS0 — pin the contracts (no behaviour change)

- Add `AccountRole`, `CoachLink` invariants, `CoachNote` validation and the
  coaching DTOs with no consumers.
- Extend `AuthSessionResponse` / `CurrentUser` with optional `roles` and
  `coach`.
- Add this plan to the docs index.
- Acceptance: both workspaces typecheck; no route or screen changes; existing
  payloads still validate.

### WS1 — persistence and migration

- Add `roles`, `coach`, `coachLinkedAt`, `coachUnlinkedAt` to the `Athlete`
  schema with defaults; add the `{ coach: 1 }` index.
- Add `CoachInvite` and `CoachNote` models and indexes.
- Add `server/scripts/migrate-coach-roles.mjs` (idempotent, `--dry-run`):
  `updateMany({ roles: { $exists: false } }, { $set: { roles: ['athlete'] } })`,
  create indexes, report counts. No data is moved.
- Acceptance: rerun writes zero rows on the second pass; a new account has
  `roles: ['athlete']` and `coach: null`; index list matches the plan.

### WS2 — roles in the session and the coach gate

- `loadAthlete` projection returns `roles` and `coach`.
- `publicUser` and `sessionResponse` return `roles` and the coach summary (one
  extra lookup only when `coach` is set; cache-shape additive).
- Add `requireCoach` and `resolveCoachSubject` with the 401/403/404/503 matrix.
- Refactor `loadTrainingData` to accept the subject shape.
- Acceptance: athlete routes are byte-compatible; a caller without the `coach`
  role gets 403 on coach routes; a coach with a foreign athlete id gets 404;
  DB-down coach reads are 503.

### WS3 — invite lifecycle (24h)

- `CoachInviteToken` + hashing + 24h TTL; `CoachInvite` repository functions.
- `POST /api/coach/invites`, `GET /api/coach/invites`,
  `DELETE /api/coach/invites/:id`, `GET /api/coach/invites/preview`,
  `POST /api/coach/invites/accept`.
- Extend `POST /api/auth/register` with optional `inviteToken`; link after the
  account row exists. Keep the current response and cookie behaviour.
- Add `coach_invite` email template (en + pt, 24h) and sender.
- Add `DELETE /api/coach/athletes/:id` and `DELETE /api/me/coach`.
- Acceptance: token is single-use, hashed, expires in 24h; mismatched email 403;
  self-link 403; already-assigned follows §Reassignment; concurrent accepts
  produce one link; revoke works; unlink/leave preserve activities and feedback;
  rate limiter applies.

### WS4 — coach reads and writes

- Implement the roster aggregation and the per-athlete reads listed above.
- Reuse `planWeek`, `planToday`, `buildProgress`, the activity sanitizer and the
  feedback query. Do not fork the engine.
- Activity detail checks subject ownership and never calls the provider.
- Implement `PUT .../goals`, `POST .../sync` and the coach-note CRUD.
- Attach `coachNote` to `planWeek`/`planToday` with one query per read.
- Acceptance: every response matches the athlete route fixture for the same
  athlete, plus `coachNote`; roster is bounded and returns no email; a coach
  cannot read or write another coach's athlete; goal write anchors the week and
  clears the athlete's AI cache; sync returns the existing `SyncResult`; notes
  are scoped by date and author.

### WS5 — client coach module and screens

- Add the `coaching` module (ports, use cases, repository, composables, DTOs,
  container) and `features/coach/` views/components.
- Add goal editing, sync action and the coach-note editor; render the note on
  the athlete's own week/today.
- Add `/join` view for invited users: preview → register (new) or sign in
  (existing) → accept → redirect. Email is fixed from the invite.
- Add the roster and athlete screens with loading/empty/error/success states.
- Acceptance: a coach can invite, see the pending invite, accept from a second
  account, see the athlete in the roster, read week/progress/activities, edit the
  goal, sync, write a note, unlink; the athlete sees the note and can leave.

### WS6 — role-aware shell and settings

- `useAuth` exposes `roles`/`isCoach`; route guard enforces `requiresRole`.
- Sidebar and mobile menu show the coaching group only for `isCoach`; the
  athlete training group stays for everyone.
- Settings cards for coach/athlete; i18n both catalogues.
- Acceptance: an athlete never sees a coach link; a coach lands on `/coach` and
  keeps their own training nav; a direct `/coach` visit by an athlete redirects
  to `/workout`; keyboard and screen-reader navigation pass.

### WS7 — deletion, consent and observability hardening

- Extend `DELETE /api/me` for coach/athlete cases, invites and notes.
- Athlete can revoke access in one action; the coach's roster updates on next
  read. No cached coach read survives an unlink beyond the resource invalidation.
- Log lifecycle events (`invite_created`, `invite_accepted`, `unlinked`,
  `left`, `coach_goal_saved`, `coach_note_saved`) without emails, tokens or note
  bodies; Sentry capture for 5xx only.
- Acceptance: deleting a coach detaches all athletes and removes invites/notes
  atomically (or reports the non-atomic fallback honestly); deleting an athlete
  removes roster, invites and notes; no token, email or athlete note appears in
  logs.

### WS8 — docs and glossary

- `CONTEXT.md`: add **Coach**, **Athlete**, **Coach Link**, **Coach Invite**,
  **Coach Note**, **Roster**, with `_Avoid_` lines (`trainer`, `client`, `team
  member`, `connection`).
- `CLAUDE.md`: add the `coaching` module, the role gate, the coach namespace and
  the new contracts.
- `README.md`: endpoint inventory rows; coach writes are goal/note/sync only.
- Acceptance: docs match the code; no route exists only in docs.

## Sequencing

```text
WS0 → WS1 → WS2 → WS3 → WS4 → WS5 → WS6 → WS7 → WS8
```

Rules:

- WS1 lands before anything writes `roles`/`coach`.
- WS2 lands before WS3 so no invite can link without the gate in place.
- WS3 lands before WS4 so the roster has a real relationship to read.
- WS5 and WS6 land together behind the role gate; a coach screen without the
  nav gate is a broken experience, and a nav gate without the server gate is a
  security bug.
- WS7 is not optional before production: a coach deletion must not leave
  dangling athlete links, invites or notes.

## Reassignment policy (open — explain before deciding)

An athlete already linked to coach A receives an invite from coach B. Three
viable policies:

### A. Unlink first

Acceptance only succeeds when `coach` is null. The athlete (or coach A) must
call `DELETE /api/me/coach` or `DELETE /api/coach/athletes/:id`, then accept.

- Pros: one write path, the simplest invariant, no hidden replacement, clear
  audit (`coachUnlinkedAt` then `coachLinkedAt`).
- Cons: two steps for the athlete. If the athlete does not know the old coach
  can be left, the invite seems broken. The client must explain the unlink step.
- Race: still safe; the second accept sees `already_assigned`.

### B. Replace on accept

Accepting a new invite atomically overwrites `coach`, records the previous coach
and timestamp, and revokes the old coach's access.

- Pros: one step for the athlete; consent is the accept action.
- Cons: the old coach loses access silently; an old invite accepted weeks later
  could replace a current link unexpectedly. Needs a link-history record for
  audit, plus a “you were unlinked” signal to the old coach.
- Race: the conditional update must allow replacement, so the “at most one”
  guarantee comes from the single field, not the filter.

### C. Confirm-and-replace (recommended)

`POST /api/coach/invites/accept` succeeds directly when `coach` is null. When
the athlete already has another coach it returns `409 already_assigned` with
`requiresConfirmation: true` and the current coach summary; the client shows
“Leave A and join B?”. A second call with `{ token, confirmReplace: true }`
performs the replacement atomically.

- Pros: one screen, explicit consent, no silent revocation, works for both
  coaches and athletes, keeps the audit fields meaningful.
- Cons: one extra boolean + confirmation UI; the old coach still needs a signal
  (email or roster refresh) to know they lost access.
- Race: fine; the confirm call is still a conditional update keyed on the
  current `coach` value.

**Recommendation:** C. It matches the product's “explicit and honest” posture,
avoids the two-step dead end of A, and avoids B's silent revocation. The only
extra work is one 409 shape and one confirmation step in `JoinView`.

## Contracts preserved

| Contract | Guarantee |
| --- | --- |
| `GET /api/auth/session` | Same body; `roles` and `coach` are additive optional fields |
| `GET /api/me` | Same `{ user }`; `user` gains `roles`/`coach`; `{ user: null }` still answers signed out |
| `POST /api/auth/{register,login,logout}` | Same status codes, cookie flags and `tokenVersion` revocation; register additionally accepts an optional `inviteToken` |
| `/api/plan/*`, `/api/progress`, `/api/activities*`, `/api/goals` | Unchanged request/response and athlete-only authorization; `coachNote` is additive |
| `POST /api/plan/feedback` | Still athlete-owned; a coach has no write route |
| `DELETE /api/me` | Same `{ ok, deleted, atomic }`; count can include invite/note rows |
| No database | `/api/health` and `/api/providers/status` answer; data and coach routes answer 503 |
| Provider tokens | Never read by passive coach reads, never returned, never logged; only the explicit coach sync write uses the athlete's connection |
| Engine | A coach edits goals and notes; the same deterministic engine still picks every workout |

## Verification

Per workstream, and as the final gate:

- Server: `npm run typecheck --prefix server`, `npm test --prefix server`.
- Client: `npm run typecheck --prefix client`, `npm run lint --prefix client`,
  `npm run format:check --prefix client`, `npm test --prefix client`,
  `npm run build --prefix client` (chunk budget still enforced).
- Server boot smoke: `node --import ./scripts/register-alias.mjs src/index.ts`
  with `PORT` and `JWT_SECRET`, then `curl /api/health` and a coach route signed
  out (401, not 500).
- Netlify bundle:
  `npx esbuild functions/api.mjs --bundle --platform=node --format=esm --external:express --external:mongoose --external:serverless-http`.
- Dependencies: `npm audit --prefix server --audit-level=high` and
  `npm audit --prefix client --audit-level=high`; report even when clean.
- Styles: `grep -RnE 'style="|z-\[|text-\[#|bg-\[#' client/src --include='*.vue'`
  shows only dynamic bindings.
- Playwright: `npx playwright test`; add a coach roster a11y check once the
  session-fixture gap in `client/tests/e2e/a11y.spec.ts` is fixed.
- Migration dry run and rerun on a copy of the real collection set; count parity:
  every athlete has `roles`, no athlete has two links, every invite points at a
  real coach.

### New tests

| File | Covers |
| --- | --- |
| `server/tests/unit/coach-link.test.ts` | self-link, coach role, single-link, idempotent same-coach retry, unlink preserves training fields |
| `server/tests/unit/coach-invite.test.ts` | token TTL/hash, 24h expiry, single-use, email mismatch, coach-invitee allowed, concurrent accept yields one link |
| `server/tests/unit/coach-auth.test.ts` | 401/403/404/503 matrix, foreign athlete not enumerable, athlete blocked from `/api/coach/**`, coach who is also athlete keeps own routes |
| `server/tests/unit/coach-roster.test.ts` | aggregation summary, bounded pagination, no email field |
| `server/tests/unit/coach-note.test.ts` | date/body validation, author scoping, one note per coach/athlete/date, engine ignores notes |
| `client/src/modules/auth/infrastructure/composable/__tests__/useAuth.test.ts` | roles/isCoach computed, coach summary, session reset |
| `client/src/modules/coaching/**/__tests__/*.test.ts` | invite/accept/unlink/goal/note use cases, roster cache invalidation |
| `client/src/router/__tests__/guard.test.ts` | `requiresRole` redirects both directions |
| `client/tests/e2e/coach.spec.ts` (when the session fixture exists) | roster a11y, invite dialog keyboard flow, note editor |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| IDOR: coach reads or writes an athlete they do not own | Single `resolveCoachSubject`; 404 for foreign ids; no athlete id accepted on existing routes |
| Two coaches linked under a race | Conditional `findOneAndUpdate` filtered on the current `coach` value; integration test fires two accepts |
| Invite token leak in logs or email forwarding | Token hashed at rest, never logged, single-use, 24h TTL, email-match check on accept |
| Coach account deletion leaves dangling links, invites or notes | Same erasure transaction detaches athletes and deletes invites/notes; standalone-mongod fallback reported honestly |
| Health/PII exposure to a coach | Link is consented through accept; athlete can leave in one action; notes are plain text; roster omits email |
| Coach overrides the engine | No write route for workout type/distance/date or RPE; only goal, note and sync |
| Coach sync spends the athlete's provider quota | Dedicated limiter per coach+athlete; response keeps `guarded`/`truncated`; no token leaves the server |
| Activity detail enrichment with the coach as caller | Coach route returns stored laps/streams only and never loads provider credentials |
| Role drift: client shows coach UI to a non-coach | Server 403 is authoritative; client guard is convenience only |
| Roster N+1 queries at scale | Aggregation with `$lookup`, bounded `per_page`, existing `{ athlete, date }` index; add a cap and a load test before a large cohort |
| AI quota consumed by coach page views | No AI route in the coach namespace in v1; the deterministic week carries `programmeRole` |
| Existing clients break on session shape | New fields are optional and additive; old fixture tests keep passing |

## Non-goals (v1)

- Coach-authored workouts, plan overrides, workout type/distance/date edits, or
  RPE/feedback writes. The engine decides; the coach edits inputs.
- Coach-to-coach teams, organisations, or an athlete with more than one coach.
- Public coach discovery, coach profiles or an athlete-initiated coach search.
- Coach mobile push/email notifications and a notification feed for roster
  activity (the old coach learning about a replacement is a follow-up).
- AI coach copy for a coach viewing an athlete (`/api/coach/**/plan/ai/week`).
- Feeding coach notes into the AI prompt (v1 notes are display-only).
- Per-athlete visibility toggles (hide HR, hide notes). The link itself is the
  consent; a granular consent matrix is a later product decision.
- Migrating the scalar link to a join collection. The model allows it later
  without changing the wire contract if the scalar is kept as the active link.

## Open questions

1. **Reassignment policy.** §Reassignment explains A (unlink first), B (replace
   on accept) and C (confirm-and-replace, recommended). Pick one before WS3.
