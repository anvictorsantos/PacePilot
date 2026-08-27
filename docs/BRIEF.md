# BRIEF — PacePilot (Adaptive Strava Running Coach)

> One-pager. Why this exists, who it's for, what success looks like. Source: `strava-ai/CONTEXT.md`, `CLAUDE.md`, `README.md` + demo seeds.

## Problem

Strava records every run but doesn't coach. Runners juggle Strava history, spreadsheets, and generic plans that ignore recent fatigue, skipped sessions, and goal progression. No single view answers: am I building safely, what should I run today, and why? Comparing volume, pace, and hard sessions across weeks requires manual work. Generic plans don't adapt when you skip a recovery or overrun a long run.

## Audience

- **Primary:** Runner using Strava (single athlete, manages own plan)
- **Secondary (data only):** Coach/LLM explain layer — reads notes/RPE but never decides; engine decides, LLM explains
- **Context:** Strava-connected household/individual, goal types 5K/10K/half/marathon, preferred training days, taper/deload windows

## Solution (one line)

Local MEVN app that syncs Strava (7 endpoints, conservative classification), computes rolling TrainingState (7/14/28/42–84d), generates a 7-day plan from goal + preferred_days + goal_date, and adapts the next workout (and week reorder after a skip) via 7-day Feel Window (RPE/status) + last-activity deviation.

## Goals

1. One Strava sync → correct TrainingState (distance/pace/HR/hard sessions/trend/fatigue) in <1s
2. Every day has a `Workout` (recovery/easy/long/steady/tempo/threshold/interval or rest) on preferred days only → plan respects preferred_days
3. Dashboard + Today + Plan answer the brief end-to-end without a spreadsheet: weekly volume, hard sessions, next workout with target pace/HR, and why

## Success Metrics (MVP)

- Sync 20 seeded runs (5 weeks demo) → TrainingState correct, no invented data
- Plan generates 7 days in <200ms, respects preferred_days, taper (7d) and deload (14d) scale long run correctly
- Adaptive: RPE 8→downgrade one, RPE 9→recovery, RPE 10→rest; Skipped→easy (RPE≥9→recovery); deviation +25%→downgrade, +40%/+5km→recovery; next-workout-only + week reorder after skip (next hard → recovery/easy)
- Today/Week/Progress load <1s local

## Non-Goals (v1)

- Multi-athlete auth (single athlete, strava_athlete_id tag)
- Medical diagnosis (never diagnose)
- Generic "any sport" auto-detect (Run only, conservative unknown)
- Cloud hosting (local Vite + Express + live Mongo Atlas optional, demo without DB)

## Constraints

- **Stack:** MEVN — Vue 3 + Vite + Pinia + Tailwind, Express 4 + Mongoose, Chart.js
- **Hosting:** Local app, single user, `server/.env` not committed
- **Data:** Store Strava tokens server-only (httpOnly cookie JWT), never expose to client, never invent Strava data

## Open Question (none blocking MVP)

If Strava adds new activity types, keep conservative classification (unknown when uncertain) — confirm once.
