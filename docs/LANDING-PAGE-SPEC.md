# LANDING-PAGE-SPEC — PacePilot

> **Status (Oct 2026):** demo mode was removed from the server — there is no seeded data path. Activity data comes from Strava OAuth and lives in MongoDB; without a database the data routes answer 503. See `README.md` for current behaviour, and treat the demo references below as historical scope.

> Marketing page for the product (if you ever publish it) + the app shell landing when running locally. Not priority for MVP, but spec'd so you don't redesign later. Stack: Vue 3 + Vite + Tailwind, no extra deps.

## Goal

In 10 seconds convey: "Your Strava → adaptive coach → train smart" + CTA to connect Strava.

## Information Architecture (single page, scroll)

1. **Nav** — Logo "PacePilot" · Links: How it works · Plan · Progress · GitHub · CTA "Connect Strava"
2. **Hero** — Headline: "Your runs, one adaptive coach." Sub: "Strava supplies evidence, engine decides, coach explains. 7-day plan that bends to fatigue, skips, and goals." CTA: "Connect Strava". Visual: Today workout card or plan week grid. No stock photos.
3. **Trust bar** — "Local-first · Your data stays in your Mongo · Strava OAuth · 7/14/28/84d windows" + metric "7/14/28/84d windows"
4. **How it works (3 steps)**
   - 1. Connect Strava — "7 endpoints, conservative classification."
   - 2. Get your plan — "Goal + preferred days + taper/deload → 7-day plan."
   - 3. Adapt — "RPE/skip/deviation → next workout + week reorder on preferred days."
5. **Plan section** — Cards for recovery/easy/long/steady/tempo/threshold/interval with distance/intensity.
6. **Progress preview** — 2-col: left = volume chart, right = bullets "Hard sessions, trend, goal progress". Link "Explore progress →"
7. **Adaptive explainer** — Mini table: "RPE 8→downgrade, 9→recovery, 10→rest, Skipped→easy" + badge "Engine decides, LLM explains"
8. **Privacy** — "Local Vite + Express + live Mongo you control. Tokens httpOnly, never exposed."
9. **CTA footer** — "Ready to run today?" → "Connect Strava" + "Read PRD"

## Copy Tone

Direct, runner-friendly, no buzzwords. Numbers over adjectives. "Evidence-based" not "AI-powered".

## CTA Behaviour

- Local: `Connect Strava` → `GET /api/strava/authorize` → dashboard. If no Strava credentials are configured, say so instead of offering a demo.
- Published: `Join waitlist` → email capture → Mongo `waitlist`.

## SEO / Meta

- Title: "PacePilot — Adaptive Strava Running Coach"
- Desc: "Sync Strava. 7-day plan from goals + preferred days. Adapts to RPE, skips, and long-run deviation."
- OG image: plan week grid + headline.

## Responsive

- Mobile: stacked hero, 1-col steps, charts scrollable. Tailwind `sm/lg`.

## Out of Scope

- Pricing table (no SaaS v1), testimonials, blog, i18n.

## Acceptance

- Page renders at `/`, Lighthouse >90 perf + a11y, all CTAs route correctly, copy has zero claims about medical diagnosis.
