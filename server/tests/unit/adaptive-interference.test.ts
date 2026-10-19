import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { adaptiveFromInterference } from '@/modules/training/domain/adaptive.ts'
import type { ActivityRecord } from '@/modules/training/domain/training-state.ts'

const HOUR = 3_600_000
const now = Date.now()

function cross(hoursAgo: number, kind = 'hiit'): ActivityRecord {
  return {
    date: new Date(now - hoursAgo * HOUR),
    workout_type: 'other',
    kind,
    moving_time_min: 45,
    avg_hr: 155,
  }
}

function hardRun(hoursAgo: number): ActivityRecord {
  return {
    date: new Date(now - hoursAgo * HOUR),
    workout_type: 'interval',
    kind: 'run',
    distance_km: 8,
    avg_pace_sec_km: 300,
  }
}

describe('cross-training interference', () => {
  test('a hard session within the last day downgrades the next quality slot', () => {
    const change = adaptiveFromInterference([cross(5)], 'threshold', now)
    assert.equal(change?.type, 'tempo')
    assert.match(change?.reason ?? '', /hiit session 5h ago/)
  })

  test('one stacked next to a hard run still counts at 36h', () => {
    const change = adaptiveFromInterference([hardRun(40), cross(36)], 'interval', now)
    assert.equal(change?.type, 'threshold')
    assert.match(change?.reason ?? '', /stacked with a hard run/)
  })

  test('the same session with no nearby hard run is ignored past 24h', () => {
    assert.equal(adaptiveFromInterference([cross(36)], 'interval', now), null)
  })

  test('mobility and rides never interfere', () => {
    assert.equal(adaptiveFromInterference([cross(2, 'mobility')], 'threshold', now), null)
    assert.equal(adaptiveFromInterference([cross(2, 'ride')], 'threshold', now), null)
  })

  test('easy slots are left alone', () => {
    assert.equal(adaptiveFromInterference([cross(2)], 'easy', now), null)
    assert.equal(adaptiveFromInterference([cross(2)], 'long', now), null)
  })

  test('a session older than 48h is stale', () => {
    assert.equal(adaptiveFromInterference([cross(60)], 'threshold', now), null)
  })
})
