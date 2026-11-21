# DESIGN-GUIDELINES — PacePilot

> **Status (Oct 2026):** demo mode was removed from the server — there is no seeded data path. Activity data comes from Strava OAuth and lives in MongoDB; without a database the data routes answer 503. See `README.md` for current behaviour, and treat the demo references below as historical scope.

> Visual language for Vue 3 + Vite + Tailwind. Goal: calm graphite, white actions, orange only where the eye should land first.

## Principles

- **Graphite, not orange:** the surface is near-black, the primary action and active nav are off-white. Orange is an accent, never a background or CTA.
- **Mono for numbers, sans for prose:** distances, paces, dates, labels and table values use `font-mono` and tabular figures; headings, copy and buttons use Inter.
- **Sentence case:** headings and labels are written in sentence case. Uppercase survives only on tiny mono micro-labels and table headers.
- **Hairlines, not blocks:** separation comes from `border-white/10` rules and 1px gaps, not heavy fills or glows.
- **Density with air:** compact cards, a 300–320px rail, and generous page margins.

## Tokens

```css
--primary: #ECECEF; --primaryBright: #FFFFFF;
--accent: #F97316; --accentBright: #FB923C;
--background: #0A0A0D; --panel: #0C0C10; --band: #0E0E13;
--card: #141419; --cardSecondary: #1A1A21;
--fg: #ECECEF; --muted: #9B9BA4; --faint: #7D7D86; --ink: #C9C9CE;
--border: rgba(255,255,255,0.085); --border-strong: rgba(255,255,255,0.18);
--success: #7FBF8F; --warning: #E0A85C; --danger: #E4443C; --dangerBright: #F0605A;
```

- Tailwind only, no component library. Borders use `border-white/10` and `border-white/20` (the two hairlines above). Radii: buttons `rounded-lg` (8px), cards `rounded-xl` (12px), inner cells `rounded`/`rounded-xs` (6–8px), frames `rounded-xl`–`rounded-2xl`.
- Focus ring is orange (`#F97316`) and only on `:focus-visible`.
- Dark sidebar on desktop; the mobile menu is a right drawer. No bottom nav.

## Typography

- **Sans:** Inter, self-hosted variable 400–800 (`/fonts/inter-latin-400-800.woff2`). Use 400/500; the config collapses 600+ to 600.
- **Mono:** system mono stack (`ui-monospace`, SF Mono, Menlo) — numbers, dates, kickers, table values, micro-labels.
- **Scale (project tokens):** `text-micro` 9 · `text-caption` 10 · `text-label` 11 · `text-body` 13 · `text-lead` 15 · `text-title` 22 · `text-page` 27 · `text-stat` 26 · `text-section` 38 · `text-figure` 46 · `text-h3` 25 · `text-h2` 32 · `text-h1` 44.
- **Patterns:** page title `font-medium text-page tracking-tight`; section heading `text-section`; big session value `font-mono font-medium text-figure tracking-tight`; stat value `font-mono text-stat`; kicker `font-mono text-label text-faint`; micro-label `font-mono text-caption text-faint uppercase tracking-widest`.

## Layout & Shell

- **App shell:** 224px sidebar (`w-56`, `bg-panel`, border-r) + content column. Content padding `md:px-9 md:py-7`.
- **Page head:** left = mono date/context above `text-page` title; right = mono meta (week, volume, trend), right-aligned.
- **Grids:** Today `grid lg:grid-cols-[1fr_300px]`; Progress/Goals/Settings `grid lg:grid-cols-[1fr_320px]`; Plan week `grid-cols-7` (3 on tablet, stacked on phone). `items-start` so cards keep their own height.
- **Public pages:** landing max width `1240px`, `px-6 lg:px-12`; landing bands alternate `bg-background` / `bg-band`.

## Components (`client/src/components` shared; `client/src/features/*/components` feature-specific)

- **Card:** `bg-card border border-white/10 rounded-xl p-4.5`–`p-6`. Rail cards `p-4.5`, content cards `p-6`.
- **Panel heading:** `font-medium text-body text-primary`; hint `text-body text-faint`.
- **Button primary:** `bg-primary text-background font-medium rounded-lg px-4 py-2.5` (white on graphite). Ghost: `border border-white/20 text-muted hover:text-primary`.
- **Inputs/selects:** `bg-cardSecondary border border-white/20 rounded-lg px-3 py-2.5 text-body text-primary placeholder:text-faint`; labels `text-label text-muted`.
- **Stat strip:** one `bg-white/10` 1px grid gap, `bg-card` cells, value `font-mono text-stat`, caption `text-label text-faint`.
- **Bars:** track `bg-[#26262e]`, planned `bg-[#2c2c34]`, current/primary `bg-primary`; orange `bg-accent` only for a quality segment or a highlighted dot.
- **Charts:** Chart.js + vue-chartjs. Grid `#232329`, line `#9B9BA4`, final point `#F97316`, axis text mono `text-caption text-faint`.
- **Session structure:** 3px-gap segmented bar (warmup neutral, main accent, cooldown neutral) with a mono label row beneath; not three bordered boxes.
- **Icons:** Heroicons-style inline SVG, 14–18px, `stroke-width 1.5`, `text-muted`/`text-faint`; sidebar icons are inline paths in `AppSidebar.vue`. No emoji, no filled icon sets.
- **Brand mark:** white `P` PNG (`public/logo-white.png`, transparent, 128px) at 18–20px. App icons `icon-180/192/512.png` and `favicon.svg` carry the same white mark on the `#0A0A0D` tile.

## States

- **Empty:** `EmptyState` with a CTA to connect Strava.
- **Loading:** `Skeleton` rows, not spinner.
- **Success:** Toast via `useToast` ("Feedback saved — coach will adapt").

## Accessibility (baseline)

- Contrast ≥4.5:1, keyboard reachable, focus ring, `aria-label` on charts. Orange is decorative/highlight only — never the sole carrier of meaning.

## What Not to Do

- No orange CTAs or orange section backgrounds; orange is accent only.
- No uppercase display headings; no letter-spaced uppercase beyond mono micro-labels.
- No gradients, glows, glass or neumorphism; no light theme (dark only v1).
- No heavy `bg-white/10` card fills — use hairlines and `bg-card`/`bg-cardSecondary`.
- No custom icon set — Heroicons SVG only. No marketing adjectives on dashboard — labels are nouns.

## File Location

- Tokens: `client/tailwind.config.js` + `client/src/assets/styles.css`
- Shell/layouts: `client/src/layouts/*`; shared UI: `client/src/components/ui/*`, `client/src/components/charts/*`, `client/src/components/icons/*`; feature UI: `client/src/features/*/components/*`
