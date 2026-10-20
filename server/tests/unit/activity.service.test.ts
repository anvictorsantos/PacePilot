import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractTrophies,
  normalizeActivity,
  normalizeLaps,
  normalizeStreams,
  isRelevantRun,
  classifyActivity,
} from '@/modules/activities/application/activity.service.ts'

/** The fields classifyActivity actually reads. Its service signature is
 *  untyped, and its `recentAvgPace` default of `null` narrows the parameter to
 *  `null`, so the typed view below states the baseline the callers really pass. */
type ClassifiableActivity = {
  distance_km?: number
  distance_m?: number
  moving_time_min?: number
  moving_time_s?: number
  avg_pace_sec_km?: number | null
  avg_hr?: number | null
  elevation_m?: number
  laps?: unknown[]
}
const classify = classifyActivity as (
  activity: ClassifiableActivity,
  recentAvgPace?: number | null
) => string

const RUN = {
  id: 999,
  sport_type: 'Run',
  start_date: '2026-03-01T08:00:00Z',
  distance: 10000,
  moving_time: 3000,
  elapsed_time: 3100,
  average_speed: 3.333,
  total_elevation_gain: 50,
  average_heartrate: 150,
  max_heartrate: 175,
  average_cadence: 85,
  has_heartrate: true,
  calories: 600,
}

describe('normalizeActivity', () => {
  test('derives km, minutes and pace from Strava metric fields', () => {
    const a = normalizeActivity(RUN)
    assert.equal(a.strava_activity_id, 999)
    assert.equal(a.distance_km, 10)
    assert.equal(a.moving_time_min, 50)
    assert.equal(a.avg_pace_sec_km, 300) // 1000 / 3.333 ≈ 300 s/km
    assert.equal(a.avg_hr, 150)
  })

  test('doubles cadence, because Strava stores steps-per-leg', () => {
    assert.equal(normalizeActivity(RUN).avg_cadence, 170)
  })

  test('survives a payload with nothing but an id', () => {
    const a = normalizeActivity({ id: 1 })
    assert.equal(a.distance_km, 0)
    assert.equal(a.avg_pace_sec_km, null)
    assert.ok(a.date instanceof Date)
  })

  test('keeps the raw payload for debugging', () => {
    assert.equal(normalizeActivity(RUN).raw, RUN)
  })
})

describe('normalizeLaps', () => {
  test('maps Strava laps to the table shape with a positional index', () => {
    const laps = normalizeLaps([
      { distance: 1000, moving_time: 300, elapsed_time: 310, average_speed: 3.333, average_heartrate: 150, total_elevation_gain: 12 },
      { distance: 500, moving_time: 200, average_speed: 2.5 },
    ])
    assert.deepEqual(laps, [
      { index: 1, distance: 1000, moving_time: 300, elapsed_time: 310, avg_heartrate: 150, elev: 12, avg_pace_sec_km: 300 },
      { index: 2, distance: 500, moving_time: 200, elapsed_time: null, avg_heartrate: null, elev: null, avg_pace_sec_km: 400 },
    ])
  })

  test('degrades to an empty array when Strava sends no laps', () => {
    assert.deepEqual(normalizeLaps(undefined), [])
    assert.deepEqual(normalizeLaps({}), [])
  })
})

describe('normalizeStreams', () => {
  test('flattens the key_by_type shape and lists what is available', () => {
    const { streams, available } = normalizeStreams({
      time: { data: [0, 1, 2] },
      distance: { data: [0, 2.5, 5] },
      heartrate: { data: [120, null, 130] },
    })
    assert.deepEqual(streams, {
      time: [0, 1, 2],
      distance: [0, 2.5, 5],
      heartrate: [120, null, 130],
    })
    assert.deepEqual(available, ['time', 'distance', 'heartrate'])
  })

  test('accepts the legacy array shape and ignores unknown keys', () => {
    const { streams, available } = normalizeStreams([
      { type: 'distance', data: [0, 1] },
      { type: 'velocity_smooth', data: [2.5, 2.6] },
      { type: 'watts', data: [1, 2] },
    ])
    assert.deepEqual(streams, { distance: [0, 1], velocity_smooth: [2.5, 2.6] })
    assert.deepEqual(available, ['distance', 'velocity_smooth'])
  })

  test('keeps latlng as coordinate pairs, preserving gaps for alignment', () => {
    const { streams, available } = normalizeStreams({
      time: { data: [0, 1, 2] },
      latlng: {
        data: [
          [38.72, -9.14],
          [null, null],
          [38.73, -9.15],
        ],
      },
    })
    assert.deepEqual(streams.latlng, [
      [38.72, -9.14],
      null,
      [38.73, -9.15],
    ])
    assert.deepEqual(available, ['time', 'latlng'])
  })

  test('an empty payload yields no streams rather than throwing', () => {
    assert.deepEqual(normalizeStreams(null), { streams: {}, available: [] })
  })
})

describe('isRelevantRun', () => {
  test('accepts every run sport Strava reports', () => {
    for (const sport of ['Run', 'TrailRun', 'VirtualRun']) {
      assert.equal(isRelevantRun({ sport_type: sport }), true, sport)
    }
  })

  test('rejects non-run sports', () => {
    for (const sport of ['Ride', 'Swim', 'Workout']) {
      assert.equal(isRelevantRun({ sport_type: sport }), false, sport)
    }
  })
})

describe('classifyActivity', () => {
  const at = (over: Record<string, unknown>) => normalizeActivity({ ...RUN, ...over })

  test('short runs are recovery', () => {
    assert.equal(classify(at({ distance: 1500, moving_time: 600 })), 'recovery')
  })

  test('distance or duration alone marks a long run', () => {
    assert.equal(classify(at({ distance: 20000 })), 'long')
    assert.equal(classify(at({ distance: 16000, moving_time: 6000 })), 'long')
  })

  test('compares against the athlete pace baseline', () => {
    // Baseline ratios are asserted directly against avg_pace_sec_km rather than
    // derived from speed, so the thresholds are legible.
    const paced = (pace: number, distanceKm: number, minutes: number) => ({
      distance_km: distanceKm,
      moving_time_min: minutes,
      avg_pace_sec_km: pace,
      elevation_m: 0,
      laps: [],
      avg_hr: null,
    })

    // ratio 0.83 → much faster than easy; long enough to be threshold work.
    assert.equal(classify(paced(300, 10, 50), 360), 'threshold')
    // ratio 0.83 but only 7km → tempo instead.
    assert.equal(classify(paced(300, 7, 45), 360), 'tempo')
    // ratio 1.00 → squarely easy.
    assert.equal(classify(paced(300, 10, 55), 300), 'easy')
    // ratio 1.11 → noticeably slower than baseline.
    assert.equal(classify(paced(300, 10, 62), 270), 'recovery')
    // ratio 0.90 → the steady band between tempo and easy.
    assert.equal(classify(paced(300, 10, 56), 333), 'steady')
  })

  test('returns unknown rather than guessing without a baseline', () => {
    assert.equal(classify(at({ distance: 3000, moving_time: 1200 })), 'unknown')
  })

  test('steep elevation reads as hill', () => {
    assert.equal(classify(at({ distance: 8000, total_elevation_gain: 400 })), 'hill')
  })
})

describe('extractTrophies', () => {
  test('maps segment achievements to labels', () => {
    const trophies = extractTrophies({
      segment_efforts: [
        {
          segment: { name: 'Col de la Croix' },
          elapsed_time: 300,
          achievements: [
            { type: 'pr', rank: 1, type_id: 3 },
            { type: 'overall', rank: 2, type_id: 1 },
          ],
        },
      ],
    })
    assert.equal(trophies.length, 2)
    assert.equal(trophies[0].label, 'PR')
    assert.equal(trophies[0].segment, 'Col de la Croix')
    assert.equal(trophies[1].label, '2nd fastest time')
  })

  test('handles an activity with no efforts at all', () => {
    assert.deepEqual(extractTrophies({}), [])
    assert.deepEqual(extractTrophies({ segment_efforts: [] }), [])
  })

  test('uses ordinal suffixes correctly', () => {
    const rank = (n: number) => extractTrophies({
      segment_efforts: [{ segment: { name: 'S' }, achievements: [{ type: 'overall', rank: n }] }],
    })[0].label
    assert.match(rank(1), /Fastest time/)
    assert.match(rank(2), /2nd/)
    assert.match(rank(3), /3rd/)
    assert.match(rank(11), /11th/) // the 11/12/13 special case
    assert.match(rank(21), /21st/)
  })
})