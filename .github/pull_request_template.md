<!--
PacePilot pull request.

Before opening this PR:
- Read AGENTS.md. It is the operating contract: smallest cohesive change, TypeScript,
  domain-event layout, no unrelated refactors, no dependency swaps without approval.
- For anything larger than a fix, state the outcome and the acceptance criterion first.
- Paste the checks you actually ran. Never claim a check you did not run.
-->

### Related Issue

<!-- Replace XXXX with the issue number, or write "none" for a small fix -->

**Issue:** #XXXX

### Description

<!--
What problem does this solve, and why this approach?
Name the bounded context(s) touched (training, run-day, feedback, activities, goals,
progress, account, connections, auth, waitlist, ai) and whether the change sits in
domain / application / infrastructure / ui.
-->

### Test Procedure

<!-- How did you verify it? What could break, and what did you check still works? -->

**Checks run** — mark only what you ran, and add the result:

Server (`--prefix server`)

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run verify:ai` (OpenRouter path touched)
- [ ] Boot check: `node --import ./scripts/register-alias.mjs src/index.ts` + `curl /api/health`

Client (`--prefix client`)

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm test`
- [ ] `npm run build` (under the 500 kB per-chunk budget)
- [ ] `npx playwright test` (UI or a11y touched)

Dependencies (when a `package.json` moved)

- [ ] `npm audit --audit-level=high` clean, both workspaces
- [ ] `npm outdated` reviewed for the touched workspace
- [ ] Lockfile diff is committed and matches the manifest

### Type of Change

- [ ] Bug fix (non-breaking, fixes an issue)
- [ ] New feature (non-breaking, adds functionality)
- [ ] Breaking change (existing behaviour no longer works as before)
- [ ] Refactor (no behaviour change)
- [ ] Cosmetic / design-system only
- [ ] Documentation
- [ ] Workflow / CI / tooling
- [ ] Dependency update

### Pre-flight Checklist

- [ ] The change is one cohesive unit; larger work is split into separate PRs
- [ ] New and touched code is TypeScript, `strict` clean, no unexplained casts or `@ts-ignore`
- [ ] Loading, empty, error, success and edge states are covered (UI changes)
- [ ] Every new user-visible string exists in both `pt` and `en` catalogues
- [ ] Design tokens only — no static `style`, no one-off `z-[...]` / `text-[#...]` / `bg-[#...]`
- [ ] Interactive controls are buttons/links with `cursor-pointer`, 44px touch targets, visible focus
- [ ] Touched endpoint documented: method/path, auth, schema, success shape, status codes, 503 behaviour
- [ ] No secret, token, `.env` value or personal data in the diff, logs or PR body
- [ ] No invariant, contract or test was weakened to make a check pass
- [ ] Behaviour the task did not ask to change is preserved

### Screenshots

<!--
UI: before/after at mobile width first, then desktop. Motion or multi-step flows: a
short recording beats a description. Backend: terminal output is enough.
-->

### Additional Notes

<!--
Unresolved risks, follow-ups, deferred work. An advisory with no fix and no backport
goes here with its advisory id, rationale, compensating control and review date.
-->
