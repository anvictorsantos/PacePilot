import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  calcTrainingState,
  weeklyVolumeSeries,
} from '@/modules/training/domain/training-state.ts'
import type { ActivityRecord } from '@/modules/training/domain/training-state.ts'

const DAY = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)

function run(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    date: daysAgo(1),
    workout_type: 'easy',
    kind: 'run',
    distance_km: 5,
    moving_time_min: 30,
    avg_pace_sec_km: 360,
    ...overrides,
  }
}

function cross(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    date: daysAgo(1),
    workout_type: 'other',
    kind: 'hiit',
    moving_time_min: 45,
    avg_hr: 150,
    ...overrides,
  }
}

describe('cross-training in the training state', () => {
  test('never becomes distance, run count or pace', () => {
    const state = calcTrainingState([run(), cross(), cross({ kind: 'ride' })])
    assert.equal(state.weekly.runs7, 1)
    assert.equal(state.weekly.distance7, 5)
    assert.equal(state.weekly.avgPace7, 360)
  })

  test('adds load and hard-session counts', () => {
    const state = calcTrainingState([cross(), cross(), cross({ kind: 'strength' })])
    assert.equal(state.weekly.runs7, 0)
    assert.equal(state.weekly.hardCrossSessions7, 3)
    assert.ok((state.weekly.crossLoad7 ?? 0) > 0)
    assert.ok((state.weekly.crossLoad28 ?? 0) >= (state.weekly.crossLoad7 ?? 0))
  })

  test('weights mobility below HIIT', () => {
    const hiit = calcTrainingState([cross({ moving_time_min: 30, avg_hr: 150 })])
    const mobility = calcTrainingState([
      cross({ kind: 'mobility', moving_time_min: 30, avg_hr: 150 }),
    ])
    assert.ok((hiit.weekly.crossLoad7 ?? 0) > (mobility.weekly.crossLoad7 ?? 0))
  })

  test('three hard cross sessions raise a fatigue signal', () => {
    const state = calcTrainingState([cross(), cross(), cross({ kind: 'strength' })])
    assert.ok(state.fatigueSignals?.includes('Multiple hard cross-training sessions this week'))
  })

  test('the volume series stays run-only', () => {
    const series = weeklyVolumeSeries([run(), cross()])
    assert.equal(
      series.reduce((sum, point) => sum + point.runs, 0),
      1,
    )
  })
})
