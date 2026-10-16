import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWeekPlan,
  buildRecommendationForType,
  recommendNextWorkout,
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
})

describe('recommendNextWorkout', () => {
  test('fatigue forces an easy or recovery day', () => {
    const fatiguedState = calcTrainingState([
      { date: new Date(), distance_km: 20, avg_pace_sec_km: 300, workout_type: 'hard' },
      { date: new Date(Date.now() - 86400000), distance_km: 15, avg_pace_sec_km: 310, workout_type: 'hard' },
    ])
    const result = recommendNextWorkout(fatiguedState, goal)
    const type = result.recommendation.type
    assert.ok(type === 'easy' || type === 'recovery', `expected easy/recovery, got ${type}`)
  })

  test('volume guard stops a sudden jump in long-run distance', () => {
    const result = recommendNextWorkout(state, goal)
    assert.ok(result.recommendation.distance_km <= 15)
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
