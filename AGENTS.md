# AGENTS.md — rules every coding agent follows in this repo, every iteration

## 1. Styling: Tailwind classes only, never inline styles

- Zero `style="..."` attributes in `.vue` files. Static visuals always map to
  Tailwind utilities.
- Exception: dynamic `:style` bindings driven by runtime data (e.g.
  `:style="{ width: pct + '%' }"` for data bars). Static values are never
  inlined — if no utility exists, extend the config (rule 2).
- Gradients/scrims go in `tailwind.config.js` `backgroundImage`, then used as
  `bg-<name>`.

## 2. No arbitrary values — extend the config instead

- Never `z-[1]`, `text-[#...]`, `bg-[#...]`, `leading-[...]`, `w-[...]` one-offs
  for design tokens. Use the existing scale (`z-0/10/20/50`, palette below).
- If Figma hands a new token (color, font, shadow, gradient, z-layer), add it
  to `client/tailwind.config.js` under a semantic name and use that.
- Canonical palette: `primary #F97316`, `primaryBright #FB923C`,
  `background #0B0B0F`, `card #141419`, `cardSecondary #1A1A21`,
  `muted #A1A1AA`, `ink #CECED3` (body copy on dark), `faint #74747F`
  (captions/disclosures only — never body text), `border #27272A`,
  `success #22C55E`, `warning #F59E0B`, `danger #EF4444`,
  `strava #FC4C02`, `stravaDark #E34400`, `panel #101014`,
  `track #1D1D24`, `bar #303037`, `info #3B82F6`.
- Project type scale (never `text-[Npx]` for these): `micro 9`, `caption 10`,
  `label 11`, `body 13`, `lead 15`, `title 22`, `h3 25`, `h2 32`, `h1 44`,
  `hero 64`, `display 80` (plus stock `xs/sm/base/lg/xl/...`).
- Project line-heights: `caption 12px`, `label 13px`, `display 108%`,
  `body 160%`, `loose 165%` (plus stock `none/tight/snug/relaxed`).
- Project radius/spacing/shell: `rounded-card 10px` (stock `md/lg/xl/2xl`
  otherwise), spacing `4.5/5.5/6.5` (= 18/22/26px), `max-w-shell 1440`,
  `max-w-narrow 480`, `max-w-mid 540`, `min-h-touch 44px` (a11y targets),
  scrims `bg-editorial-scrim` / `bg-card-scrim`.
- Exception — Figma frame geometry: one-off fixed `w/h` and display sizes
  taken verbatim from an approved Figma frame (e.g. `w-[584px]`,
  `text-[58px]`, hero art heights) may stay arbitrary. Everything repeated
  becomes a token above. When unsure, tokenize.
- Fonts: Inter only (`font-sans`). No other families without asking.

## 3. Mobile-first + assistive tech on every change

- Layouts stack on mobile first (`grid-cols-1` → `sm:`/`lg:` up), never
  desktop-only. Fixed pixel heights get responsive variants
  (e.g. `h-64 sm:h-80 lg:h-[480px]` only when a token can't express it —
  arbitrary sizes need a comment or config entry).
- Touch targets ≥ 44px for buttons/links. No hover-only meaning.
- Every `<img>` gets a real `alt` (empty `alt=""` + `aria-hidden="true"` only
  for pure decoration). Icon components carry `aria-hidden` or
  `aria-label`, never neither.
- Interactive elements are buttons/links (`<button>`, `<a>`, `RouterLink`),
  never clickable `<div>`s. Modals: `role="dialog"`, `aria-modal`, Esc to
  close, visible focus states.
- Contrast: body text `ink`/`white` on `background` only; `muted` minimum for
  secondary text; `faint` restricted to captions ≥10px. Never gray-on-gray
  below 4.5:1 for readable text.
- Motion: transitions guarded by `prefers-reduced-motion` (see `styles.css`
  pattern). No auto-playing animation conveying information.

## 4. Verification

- `npm run build --prefix client` green before handing back.
- No new `style="`, `z-[`, `text-[#`, `bg-[#` in the diff — grep before commit:
  `grep -rn 'style="\|z-\[\|text-\[#' client/src --include='*.vue'`.

## 5. Accessibility (WCAG 2.2 AA)

### Linting & CI
- `eslint-plugin-vuejs-accessibility` enabled with strict rules (see `eslint.config.js`)
- Pre-commit hook runs `npm run lint` via husky + lint-staged
- E2E tests use `@axe-core/playwright` — run `npx playwright test` for full a11y audit

### Component Conventions (enforced by linter + code review)
| Rule | Implementation |
|------|----------------|
| **All icons** | `aria-hidden="true"` unless semantic meaning needed (then `role="img" aria-label="..."`) |
| **Interactive elements** | Only `<button>`, `<a>`, `<RouterLink>` — never `<div @click>` |
| **Custom selects/dropdowns** | Full keyboard nav (Arrow keys, Escape, Home/End, Tab trap), `aria-activedescendant` pattern |
| **Modals/dialogs** | `useDialog()` owns the contract: focus trap, Escape, scroll lock, restore focus, `role="dialog"`/`aria-modal`/name attrs. Never hand-roll it in a component |
| **Forms** | Every input has `<label for="id">` or `aria-label`, errors via `aria-describedby` + `role="alert"` |
| **Dynamic content** | `aria-live="polite"` (assertive for errors) on toast/notification regions |
| **Progress/loading** | `role="progressbar"` + `aria-valuenow/min/max` + `aria-label` |
| **Charts/images** | `role="img"` + `aria-label` with data summary; decorative = `alt="" aria-hidden="true"` |
| **Color alone** | Never sole indicator — add text/icon pattern (e.g., badge + color) |
| **Focus styles** | Never `focus:outline-none` without `:focus-visible` replacement (global in `styles.css`) |
| **Touch targets** | Minimum 44px (`min-h-touch` / `min-w-touch` utilities) |

### Reusable Composables
```js
// useResource(key, fetcher, { immediate }) — every read: cache, in-flight dedupe,
//   stale-while-revalidate, and the data/loading/error/settled/reload surface.
//   `key` may be a getter (paged lists). resetResource(key?) drops a cached read.
// useDialog(containerRef, { active, labelledby | label, onEscape, initialFocus })
//   — the whole modal contract: focus trap, Escape, body scroll lock, restore
//   focus, and the role/aria-modal/name attrs to spread onto the dialog element.
// useToast() — announcements ride on ToastContainer's per-toast role="alert" and
//   its aria-live regions; there is deliberately no separate announcer composable.
```

Deleted on purpose (all three had zero consumers while the two real modals
hand-rolled the same focus trap): `useFocusTrap`, `useAnnouncer`, `useAriaProps`.
Modal behaviour belongs to `useDialog`; live regions belong to the components that
own the region; a table of 14 one-line `aria-*` attribute builders bought nothing
that writing the attribute in the template does not.

### Testing Checklist per PR
- [ ] `npm run lint` passes (0 errors, warnings acceptable for modal overlays)
- [ ] `npm run build --prefix client` green
- [ ] Keyboard-only navigation works on new components
- [ ] Color contrast verified (devtools → Elements → Accessibility)
- [ ] Screen reader test: NVDA/VoiceOver announces dynamic content correctly

## 6. Reporting Style

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.
