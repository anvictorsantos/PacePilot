# DESIGN-GUIDELINES — PacePilot

> Visual language for Vue 3 + Vite + Tailwind. Goal: athletic, dark, orange energy, scannable training.

## Principles

- **Effort first:** Workout type/distance are larger/bolder than labels; intensity never ambiguous.
- **Dark, not fintech-neon:** `background #0B0B0F` + `card #141419` + one accent `primary #F97316`, muted neutrals.
- **One accent, one semantic pair:** Orange for primary/CTAs/nav active, success/warning/danger for signals.
- **Density over whitespace:** Training = cards + charts; compact but not drowned in padding.

## Tokens

```css
--primary: #F97316; --primaryBright: #FB923C;
--background: #0B0B0F; --card: #141419; --cardSecondary: #1A1A21;
--muted: #A1A1AA; --border: #27272A;
--success: #22C55E; --warning: #EAB308; --danger: #EF4444;
```

- Tailwind only, no component library. `rounded-xl/2xl`, `border-white/10`, Inter via Google Fonts.
- Dark sidebar on desktop, bottom nav on mobile. Orange for active nav + CTAs.

## Typography

- **Sans:** Inter 400/500/600/700.
- **Scale:** Hero `text-3xl font-bold uppercase` (Today/Plan), Page `text-2xl font-bold`, Section `text-xs uppercase tracking-widest`, Amounts `font-semibold`.

## Layout & Shell

- **App shell:** `max-w-2xl` for Today, `grid` for Plan (7 cols), `AppSidebar` dark + `AppHeader` + `MobileNav`.
- **Page containers:** Dashboard `grid`, Plan `grid-cols-2 md:grid-cols-7`, Activities `list`, Today `max-w-2xl`.

## Components (`client/src/components` shared; `client/src/features/*/components` feature-specific)

- **Card:** `bg-card border border-white/10 rounded-2xl p-5` (+ `hover:bg-white/5` where interactive), ActivityCard with distance/pace/HR/elevation.
- **Button:** Primary `bg-primary hover:bg-primaryBright text-white font-semibold py-2.5 rounded-xl`, Ghost `bg-white/10 hover:bg-white/15`.
- **MetricCard:** `bg-card border rounded-2xl` with label `text-xs text-muted uppercase tracking-widest`.
- **Charts:** Chart.js + vue-chartjs, `WeeklyVolumeChart` (Bar), `PaceChart` (Line reusable for pace/HR/elevation/cadence), dark tooltips.
- **Icons:** Heroicons SVG only — one file per icon in `components/icons/*.vue` with `cls` prop. No emoji.

## States

- **Empty:** `EmptyState` with CTA to connect Strava or view demo.
- **Loading:** `Skeleton` rows, not spinner.
- **Success:** Toast via `useToast` ("Feedback saved — coach will adapt").

## Accessibility (baseline)

- Contrast ≥4.5:1, keyboard reachable, focus ring, `aria-label` on charts.

## What Not to Do

- No glass/neumorphism, no extra dep, no light default (dark only v1).
- No custom icon set — Heroicons SVG only.
- No marketing adjectives on dashboard — labels are nouns.

## File Location

- Tokens: `client/src/assets/styles.css` (Tailwind directives)
- Shell/layouts: `client/src/layouts/*`; shared UI: `client/src/components/ui/*`, `client/src/components/charts/*`, `client/src/components/icons/*`; feature UI: `client/src/features/*/components/*`
