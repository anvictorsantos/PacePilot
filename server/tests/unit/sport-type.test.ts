import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  ActivityKind,
  isHardCrossKind,
  isRunKind,
} from '@/modules/activities/domain/value-object/ActivityKind.ts'
import {
  SPORT_KINDS,
  kindForSport,
  kindOfActivity,
} from '@/modules/activities/domain/value-object/SportType.ts'

describe('sport taxonomy', () => {
  test('covers every sport_type the Strava API can return', () => {
    // The documented list on the uploads page has 56 values; a new one appearing
    // in a response must be a deliberate edit here, not a silent `other`.
    assert.equal(Object.keys(SPORT_KINDS).length, 56)
  })

  test('runs are the only family that counts as volume', () => {
    for (const sport of ['Run', 'TrailRun', 'VirtualRun']) {
      assert.equal(kindForSport(sport), ActivityKind.Run)
      assert.equal(isRunKind(kindForSport(sport)), true)
    }
    assert.equal(isRunKind(kindForSport('Ride')), false)
    assert.equal(isRunKind(kindForSport('HighIntensityIntervalTraining')), false)
  })

  test('only strength and HIIT are hard cross-training', () => {
    const hard = Object.keys(SPORT_KINDS).filter((sport) => isHardCrossKind(kindForSport(sport)))
    assert.deepEqual(hard.sort(), [
      'Crossfit',
      'HighIntensityIntervalTraining',
      'WeightTraining',
      'Workout',
    ])
  })

  test('an unknown or missing sport never becomes a run', () => {
    assert.equal(kindForSport('SkiJoring'), ActivityKind.Other)
    assert.equal(kindForSport(null), ActivityKind.Other)
    assert.equal(kindOfActivity({ sport: 'SkiJoring' }), ActivityKind.Other)
  })

  test('a legacy row with neither kind nor sport reads as a run', () => {
    // Rows predating `kind` came from the runs-only import.
    assert.equal(kindOfActivity({}), ActivityKind.Run)
  })

  test('the stored kind wins over the sport', () => {
    assert.equal(
      kindOfActivity({ kind: ActivityKind.Strength, sport: 'Run' }),
      ActivityKind.Strength,
    )
  })
})
