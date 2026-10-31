# ADR 0001 — Block disposable email domains at registration

- Status: accepted
- Date: 2026-10-31

## Context

Verification mail is the only proof an address belongs to the athlete. A disposable mailbox (`denialexeeff@kajaib.studio` and thousands like it) makes signup free and fake, inflates account counts, and gives abuse a fresh address per attempt. The address arrives through `POST /api/auth/register`, normalised by `normaliseEmail` and validated only for shape.

A maintained in-repo blocklist was rejected: it rots, and every new provider domain needs a deploy. Two third-party lookups were measured against the reported address:

| Provider | `kajaib.studio` | `gmail.com` | Credential |
| --- | --- | --- | --- |
| Kickbox open API | `disposable: false` (miss) | false | none |
| Disify | `disposable: true` (hit) | false | none |

## Decision

`registerAccount` asks a **Disify** disposable-domain lookup before hashing the password and rejects a positive answer with `400 { code: 'email_not_allowed' }`.

- Only the **domain** leaves the server: the probe address is `probe@<domain>`, so the athlete's local part never reaches the third party.
- The check covers **registration only**. Login, verification resend and password reset stay open, so an existing account is never locked out by a policy change.
- `EmailReputationChecker` is a domain port (`domain/email-reputation.ts`); the Disify adapter is `infrastructure/email/disify-email-reputation.ts`. No new npm dependency: Node's global `fetch`.
- The client localises the failure from the response `code`, not from the server's prose. `errorHandler` now echoes `code` for `AppError`.

## Consequences

- **Fail open.** Timeout (2.5 s), 429, 5xx, malformed payload or a network error logs a warning and the registration proceeds. A third party must not be able to stop signups; disposable addresses are an abuse control, not an authentication boundary.
- **Anonymous quota.** Disify allows 30 requests/minute per egress IP without a key. A 24 h in-memory cache per domain (max 1000 entries, oldest evicted) keeps that budget for normal traffic. Failures are not cached. Render's egress IP is shared, so a sustained 429 burst degrades to fail-open, not to a broken signup.
- **Cache is per process.** Multiple instances each spend their own quota; acceptable at current scale.
- **False positives are user-visible.** A legitimate small domain the provider misclassifies is rejected without a manual override. If this becomes real, add a reviewed allowlist consulted before the lookup — not a general blocklist.
- **Data protection.** The third party receives the domain and a synthetic local part, plus our egress IP. No athlete identity, no password, no account link is sent.
