import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  ActivityKind,
  isHardCrossKind,
  isRunKind,
} from '@/modules/activities/domain/value-object/ActivityKind.ts'
import {
  Sport,
  isRunSport,
  kindForSport,
  kindOfActivity,
} from '@/modules/activities/domain/value-object/Sport.ts'
import { STRAVA_SPORT_MAP, sportForStrava } from '@/modules/providers/infrastructure/providers/strava/mapping.ts'

describe('canonical sport taxonomy', () => {
  test('the Strava adapter covers all 56 documented sport types', () => {
    // A new provider value appearing in a response must be a deliberate edit in
    // that provider's adapter, not a silent `other`.
    assert.equal(Object.keys(STRAVA_SPORT_MAP).length, 56)
  })

  test('runs are the only family that counts as volume', () => {
    for (const sport of [Sport.Run, Sport.TrailRun, Sport.TreadmillRun]) {
      assert.equal(kindForSport(sport), ActivityKind.Run)
      assert.equal(isRunSport(sport), true)
    }
    assert.equal(isRunKind(kindForSport(Sport.Ride)), false)
    assert.equal(isRunKind(kindForSport(Sport.Hiit)), false)
  })

  test('Strava labels are translated at the boundary, never stored raw', () => {
    assert.equal(sportForStrava('Run'), Sport.Run)
    assert.equal(sportForStrava('VirtualRun'), Sport.TreadmillRun)
    assert.equal(sportForStrava('WeightTraining'), Sport.Strength)
    assert.equal(sportForStrava('SkiJoring'), Sport.Other)
    assert.equal(sportForStrava(null), Sport.Other)
  })

  test('only strength and HIIT are hard cross-training', () => {
    const hard = Object.keys(STRAVA_SPORT_MAP)
      .filter((sport) => isHardCrossKind(kindForSport(sportForStrava(sport))))
      .sort()
    assert.deepEqual(hard, [
      'Crossfit',
      'HighIntensityIntervalTraining',
      'WeightTraining',
      'Workout',
    ])
  })

  test('an unknown or missing sport never becomes a run', () => {
    assert.equal(kindForSport(sportForStrava('SkiJoring')), ActivityKind.Other)
    assert.equal(kindForSport(null), ActivityKind.Other)
    assert.equal(kindOfActivity({ sport: 'other' }), ActivityKind.Other)
    assert.equal(kindOfActivity({ sport: 'ski_joring' }), ActivityKind.Other)
  })

  test('a legacy row with neither kind nor sport reads as a run', () => {
    // Rows predating `kind` came from the runs-only import.
    assert.equal(kindOfActivity({}), ActivityKind.Run)
  })

  test('the stored kind wins over the sport', () => {
    assert.equal(
      kindOfActivity({ kind: ActivityKind.Strength, sport: Sport.Run }),
      ActivityKind.Strength,
    )
  })
})
