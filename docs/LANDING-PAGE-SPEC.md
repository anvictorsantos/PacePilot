# LANDING-PAGE-SPEC — PacePilot

> Marketing page for the product (if you ever publish it) + the app shell landing when running locally. Not priority for MVP, but spec'd so you don't redesign later. Stack: Vue 3 + Vite + Tailwind, no extra deps.

## Goal

In 10 seconds convey: "Your Strava → adaptive coach → train smart" + CTA to connect Strava or view demo.

## Information Architecture (single page, scroll)

1. **Nav** — Logo "PacePilot" · Links: How it works · Plan · Progress · GitHub · CTA "Connect Strava"
2. **Hero** — Headline: "Your runs, one adaptive coach." Sub: "Strava supplies evidence, engine decides, coach explains. 7-day plan that bends to fatigue, skips, and goals." CTA: "Connect Strava" (primary) + "Try demo" (secondary). Visual: Today workout card or plan week grid. No stock photos.
3. **Trust bar** — "Local-first · Your data stays in your Mongo · Strava OAuth · 7/14/28/84d windows" + metric "20 seeded runs demo"
4. **How it works (3 steps)**
   - 1. Connect Strava — "7 endpoints, conservative classification."
   - 2. Get your plan — "Goal + preferred days + taper/deload → 7-day plan."
   - 3. Adapt — "RPE/skip/deviation → next workout + week reorder on preferred days."
5. **Plan section** — Cards for recovery/easy/long/steady/tempo/threshold/interval with distance/intensity.
6. **Progress preview** — 2-col: left = volume chart, right = bullets "Hard sessions, trend, goal progress". Link "Explore progress →"
7. **Adaptive explainer** — Mini table: "RPE 8→downgrade, 9→recovery, 10→rest, Skipped→easy" + badge "Engine decides, LLM explains"
8. **Privacy** — "Local Vite + Express + live Mongo you control. Tokens httpOnly, never exposed. Demo without DB."
9. **CTA footer** — "Ready to run today?" → "Connect Strava" + "Read PRD"

## Copy Tone

Direct, runner-friendly, no buzzwords. Numbers over adjectives. "Evidence-based" not "AI-powered".

## CTA Behaviour

- Local: `Connect Strava` → `GET /api/strava/authorize` → dashboard. If no creds, show demo toggle.
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
