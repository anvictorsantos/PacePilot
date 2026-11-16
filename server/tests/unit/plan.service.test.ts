import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWeekPlan,
  buildRecommendationForType,
  getWeekMeta,
} from '@/modules/training/application/plan.service.ts'
import { calcTrainingState } from '@/modules/training/domain/training-state.ts'
import { WORKOUT_TEMPLATES } from '@/modules/training/domain/templates.ts'
import { targetPace } from '@/modules/training/domain/targets.ts'

const goal = { goal_type: '5K', days_per_week: 4, preferred_days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'] }

// getWeekMeta's `activities` default `= []` narrows it to `never[]`, so this typed
// view states the argument's real shape without touching src.
const weekMeta = getWeekMeta as unknown as (goalArg: typeof goal) => {
  currentWeek: number
  totalWeeks: number
}

const state = calcTrainingState([
  { date: new Date(), distance_km: 8, avg_pace_sec_km: 330, workout_type: 'easy' },
  { date: new Date(Date.now() - 2 * 86400000), distance_km: 10, avg_pace_sec_km: 320, workout_type: 'tempo' },
])

describe('buildWeekPlan', () => {
  test('always returns seven Monday-to-Sunday entries', () => {
    const result = buildWeekPlan(state, goal, new Date())
    assert.strictEqual(result.length, 7)
  })

  test("today's own run does not rewrite today's slot", () => {
    // A run already in Strava is not a "next workout" signal.
    const today = new Date(2026, 9, 20, 12)
    const todayRun = {
      date: new Date(2026, 9, 20, 8),
      distance_km: 4,
      avg_pace_sec_km: 359,
      workout_type: 'easy',
    }
    const before = buildWeekPlan(state, goal, today).find((d) => d.isToday)
    const after = buildWeekPlan(state, goal, today, [], [todayRun]).find((d) => d.isToday)

    assert.equal(after?.workout.type, before?.workout.type)
    assert.equal(after?.workout.distance_km, before?.workout.distance_km)
  })

  test('a completed day carries the run actually done', () => {
    const today = new Date(2026, 9, 20, 12)
    const todayRun = {
      date: new Date(2026, 9, 20, 8),
      distance_km: 4.01,
      avg_pace_sec_km: 359,
      workout_type: 'easy',
    }
    const day = buildWeekPlan(state, goal, today, [], [todayRun]).find((d) => d.isToday)

    assert.deepEqual(day?.actual, { distance_km: 4.01, workout_type: 'easy' })
  })

  test('cross-training never fills a run slot', () => {
    const today = new Date(2026, 9, 20, 12)
    const hiit = {
      date: new Date(2026, 9, 20, 8),
      distance_km: 0,
      workout_type: 'other',
      kind: 'hiit',
    }
    const day = buildWeekPlan(state, goal, today, [], [hiit]).find((d) => d.isToday)

    assert.equal(day?.actual, undefined)
  })
})

describe('buildRecommendationForType', () => {
  test('always produces a finite distance and duration', () => {
    // The recommendation is nested; these assertions previously read a flat
    // `result.distance` / `result.duration` that the function never returned.
    const { recommendation } = buildRecommendationForType(state, goal, null, 'easy')
    const { distance_km, duration_min } = recommendation
    assert.ok(distance_km != null && distance_km > 0)
    assert.ok(duration_min != null && duration_min > 0)
  })

  test('carries the engine-derived warm-up / main / cool-down split', () => {
    const { recommendation } = buildRecommendationForType(state, goal, null, 'tempo')
    const { distance_km, warmup_km, main_km, cooldown_km } = recommendation
    assert.ok(warmup_km != null && warmup_km > 0)
    assert.ok(main_km != null && main_km > 0)
    assert.ok(cooldown_km != null && cooldown_km > 0)
    assert.ok(Math.abs(warmup_km + main_km + cooldown_km - (distance_km ?? 0)) < 0.1)
  })

  test('names the athlete’s own easy pace band, not a bare label', () => {
    const { recommendation } = buildRecommendationForType(state, goal, null, 'tempo')
    assert.equal(recommendation.easy_pace, targetPace(state, 'easy'))
    assert.match(recommendation.easy_pace ?? '', /^\d+:\d{2}–\d+:\d{2} \/km$/)
  })

  test('today and the week name one distance for the same slot', () => {
    // The week plans the slot from the programme (taper/cutback/clamped average),
    // the recommendation from a template default. Two answers, one run — the
    // athlete was told 6.0 km on Today and 4.9 km on the schedule.
    const today = new Date(2026, 10, 17, 12)
    const slot = buildWeekPlan(state, goal, today).find((d) => d.isToday)
    const plannedKm = slot?.workout.distance_km
    if (!slot || plannedKm == null) throw new Error('the week must plan a distance for today')

    const { recommendation } = buildRecommendationForType(
      state,
      goal,
      null,
      slot.workout.type,
      [],
      [],
      undefined,
      { plannedKm },
    )

    assert.equal(recommendation.distance_km, plannedKm)
    // Duration was paired with the template distance; it follows the planned one.
    const template = WORKOUT_TEMPLATES[slot.workout.type]
    assert.equal(
      recommendation.duration_min,
      Math.round((template.duration_min * plannedKm) / template.distance_km),
    )
  })

  test('volume guard stops a sudden jump in long-run distance', () => {
    // Carried over from the deleted legacy `recommendNextWorkout` (unused in
    // production, kept alive only by its own test). Same guard, live path.
    const beginner = calcTrainingState([
      { date: new Date(), distance_km: 8, avg_pace_sec_km: 360, workout_type: 'easy' },
    ])
    const { recommendation } = buildRecommendationForType(beginner, goal, null, 'long')
    const distanceKm = recommendation.distance_km
    assert.ok(
      distanceKm != null && distanceKm <= 10,
      `long run of ${distanceKm}km ignores recent volume`
    )
  })
})

describe('getWeekMeta', () => {
  test('derives total weeks from the goal anchor', () => {
    const result = weekMeta(goal)
    assert.ok(result.totalWeeks > 0)
  })

  test('never returns a week outside the program', () => {
    const result = weekMeta(goal)
    assert.ok(result.totalWeeks <= 12)
  })
})
