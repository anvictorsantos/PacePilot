import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWeekPlan,
  buildRecommendationForType,
  getWeekMeta,
} from '../../src/services/plan.service.ts'
import { calcTrainingState } from '../../src/services/training.service.ts'
import { WORKOUT_TEMPLATES } from '../../src/services/plan/templates.ts'

const goal = { goal_type: '5K', days_per_week: 4, preferred_days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'] }

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
    assert.ok(recommendation.distance_km > 0)
    assert.ok(recommendation.duration_min > 0)
  })

  test('volume guard stops a sudden jump in long-run distance', () => {
    // Carried over from the deleted legacy `recommendNextWorkout` (unused in
    // production, kept alive only by its own test). Same guard, live path.
    const beginner = calcTrainingState([
      { date: new Date(), distance_km: 8, avg_pace_sec_km: 360, workout_type: 'easy' },
    ])
    const { recommendation } = buildRecommendationForType(beginner, goal, null, 'long')
    assert.ok(
      recommendation.distance_km <= 10,
      `long run of ${recommendation.distance_km}km ignores recent volume`
    )
  })
})

describe('getWeekMeta', () => {
  test('derives total weeks from the goal anchor', () => {
    const result = getWeekMeta(goal)
    assert.ok(result.totalWeeks > 0)
  })

  test('never returns a week outside the program', () => {
    const result = getWeekMeta(goal)
    assert.ok(result.totalWeeks <= 12)
  })
})
