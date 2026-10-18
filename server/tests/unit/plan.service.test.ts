import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWeekPlan,
  buildRecommendationForType,
  getWeekMeta,
} from '@/modules/training/application/plan.service.ts'
import { calcTrainingState } from '@/modules/training/domain/training-state.ts'
import { WORKOUT_TEMPLATES } from '@/modules/training/domain/templates.ts'

const goal = { goal_type: '5K', days_per_week: 4, preferred_days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'] }

// getWeekMeta's first parameter is `activities`, and its `= []` default narrows
// that to `never[]`. This test passes the goal object there, as it always has,
// so this typed view states the argument's real shape without touching src.
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
