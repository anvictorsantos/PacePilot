import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeActivity,
  normalizeLaps,
  normalizeStreams,
  isRelevantRun,
  classifyActivity,
} from '@/modules/activities/application/activity.service.ts'
import type { CanonicalActivity } from '@/modules/providers/domain/CanonicalActivity.ts'
import { Sport } from '@/modules/activities/domain/value-object/Sport.ts'
import {
  mapActivity,
  mapLaps,
  mapStreams,
  mapTrophies,
} from '@/modules/providers/infrastructure/providers/strava/mapping.ts'

/** The fields classifyActivity actually reads. */
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

const canonicalRun = (over: Partial<CanonicalActivity> = {}): CanonicalActivity => ({
  externalId: '999',
  startedAt: new Date('2026-03-01T08:00:00Z'),
  rawSport: 'Run',
  sport: Sport.Run,
  distanceM: 10000,
  movingTimeS: 3000,
  elapsedTimeS: 3100,
  avgSpeedMps: 3.333,
  maxSpeedMps: null,
  elevationM: 50,
  avgHr: 150,
  maxHr: 175,
  avgCadenceSpm: 170,
  hasHr: true,
  calories: 600,
  achievementCount: 0,
  prCount: 0,
  raw: { id: 999 },
  ...over,
})

const STRAVA_RAW = {
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
  test('derives km, minutes and pace from canonical metric fields', () => {
    const a = normalizeActivity(canonicalRun())
    assert.equal(a.provider_activity_id, '999')
    assert.equal(a.distance_km, 10)
    assert.equal(a.moving_time_min, 50)
    assert.equal(a.avg_pace_sec_km, 300) // 1000 / 3.333 ≈ 300 s/km
    assert.equal(a.avg_hr, 150)
  })

  test('keeps the canonical sport and the provider label separately', () => {
    const a = normalizeActivity(canonicalRun({ sport: Sport.TrailRun, rawSport: 'TrailRun' }))
    assert.equal(a.kind, 'run')
    assert.equal(a.sport, Sport.TrailRun)
    assert.equal(a.sport_type, 'TrailRun')
  })

  test('survives evidence with no distance or pace', () => {
    const a = normalizeActivity(canonicalRun({ distanceM: 0, movingTimeS: 0, avgSpeedMps: null }))
    assert.equal(a.distance_km, 0)
    assert.equal(a.avg_pace_sec_km, null)
    assert.ok(a.date instanceof Date)
  })

  test('keeps the provider payload for debugging', () => {
    const raw = { id: 1 }
    assert.equal(normalizeActivity(canonicalRun({ raw })).raw, raw)
  })
})

describe('normalizeLaps', () => {
  test('maps canonical laps to the table shape with a positional index', () => {
    const laps = normalizeLaps([
      {
        distanceM: 1000,
        movingTimeS: 300,
        elapsedTimeS: 310,
        avgSpeedMps: 3.333,
        avgHr: 150,
        elevationM: 12,
      },
      {
        distanceM: 500,
        movingTimeS: 200,
        elapsedTimeS: null,
        avgSpeedMps: 2.5,
        avgHr: null,
        elevationM: null,
      },
    ])
    assert.deepEqual(laps, [
      { index: 1, distance: 1000, moving_time: 300, elapsed_time: 310, avg_heartrate: 150, elev: 12, avg_pace_sec_km: 300 },
      { index: 2, distance: 500, moving_time: 200, elapsed_time: null, avg_heartrate: null, elev: null, avg_pace_sec_km: 400 },
    ])
  })

  test('degrades to an empty array when there are no laps', () => {
    assert.deepEqual(normalizeLaps(undefined), [])
    assert.deepEqual(normalizeLaps([]), [])
  })
})

describe('normalizeStreams', () => {
  test('keeps the keys the charts need and lists what is available', () => {
    const streams = normalizeStreams({
      time: [0, 1, 2],
      distance: [0, 2.5, 5],
      heartrate: [120, null, 130],
    })
    assert.deepEqual(streams, {
      streams: { time: [0, 1, 2], distance: [0, 2.5, 5], heartrate: [120, null, 130] },
      available: ['time', 'distance', 'heartrate'],
    })
  })

  test('keeps latlng as coordinate pairs, preserving gaps for alignment', () => {
    const { streams, available } = normalizeStreams({
      time: [0, 1, 2],
      latlng: [
        [38.72, -9.14],
        null,
        [38.73, -9.15],
      ],
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
  test('accepts every canonical run sport', () => {
    for (const sport of [Sport.Run, Sport.TrailRun, Sport.TreadmillRun]) {
      assert.equal(isRelevantRun({ sport }), true, sport)
    }
  })

  test('rejects non-run sports', () => {
    for (const sport of [Sport.Ride, Sport.Swim, Sport.Strength]) {
      assert.equal(isRelevantRun({ sport }), false, sport)
    }
  })
})

describe('classifyActivity', () => {
  const classify = classifyActivity as (
    activity: ClassifiableActivity,
    recentAvgPace?: number | null
  ) => string
  const at = (over: Partial<CanonicalActivity>) => normalizeActivity(canonicalRun(over))

  test('short runs are recovery', () => {
    assert.equal(classify(at({ distanceM: 1500, movingTimeS: 600 })), 'recovery')
  })

  test('distance or duration alone marks a long run', () => {
    assert.equal(classify(at({ distanceM: 20000 })), 'long')
    assert.equal(classify(at({ distanceM: 16000, movingTimeS: 6000 })), 'long')
  })

  test('compares against the athlete pace baseline', () => {
    const paced = (pace: number, distanceKm: number, minutes: number) => ({
      distance_km: distanceKm,
      moving_time_min: minutes,
      avg_pace_sec_km: pace,
      elevation_m: 0,
      laps: [],
      avg_hr: null,
    })

    assert.equal(classify(paced(300, 10, 50), 360), 'threshold')
    assert.equal(classify(paced(300, 7, 45), 360), 'tempo')
    assert.equal(classify(paced(300, 10, 55), 300), 'easy')
    assert.equal(classify(paced(300, 10, 62), 270), 'recovery')
    assert.equal(classify(paced(300, 10, 56), 333), 'steady')
  })

  test('returns unknown rather than guessing without a baseline', () => {
    assert.equal(classify(at({ distanceM: 3000, movingTimeS: 1200 })), 'unknown')
  })

  test('steep elevation reads as hill', () => {
    assert.equal(classify(at({ distanceM: 8000, elevationM: 400 })), 'hill')
  })
})

describe('Strava anti-corruption mapping', () => {
  test('mapActivity translates units, cadence and sport', () => {
    const activity = mapActivity(STRAVA_RAW)
    assert.equal(activity.externalId, '999')
    assert.equal(activity.sport, Sport.Run)
    assert.equal(activity.rawSport, 'Run')
    assert.equal(activity.distanceM, 10000)
    assert.equal(activity.avgCadenceSpm, 170) // Strava stores steps per leg
    assert.equal(activity.avgHr, 150)
  })

  test('mapLaps translates the provider shape', () => {
    const laps = mapLaps([
      { distance: 1000, moving_time: 300, average_speed: 3.333, average_heartrate: 150 },
    ])
    assert.deepEqual(laps[0], {
      distanceM: 1000,
      movingTimeS: 300,
      elapsedTimeS: null,
      avgSpeedMps: 3.333,
      avgHr: 150,
      elevationM: null,
    })
  })

  test('mapStreams flattens key_by_type and legacy shapes', () => {
    assert.deepEqual(
      mapStreams({
        time: { data: [0, 1, 2] },
        distance: { data: [0, 2.5, 5] },
      }).available,
      ['time', 'distance'],
    )
    assert.deepEqual(
      mapStreams([
        { type: 'distance', data: [0, 1] },
        { type: 'watts', data: [1, 2] },
      ]).streams,
      { distance: [0, 1] },
    )
  })

  test('mapTrophies maps segment achievements to labels', () => {
    const trophies = mapTrophies({
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

  test('mapTrophies handles an activity with no efforts', () => {
    assert.deepEqual(mapTrophies({}), [])
    assert.deepEqual(mapTrophies({ segment_efforts: [] }), [])
  })

  test('mapTrophies uses ordinal suffixes correctly', () => {
    const rank = (n: number) =>
      mapTrophies({
        segment_efforts: [{ segment: { name: 'S' }, achievements: [{ type: 'overall', rank: n }] }],
      })[0].label
    assert.match(rank(1), /Fastest time/)
    assert.match(rank(2), /2nd/)
    assert.match(rank(3), /3rd/)
    assert.match(rank(11), /11th/)
  })
})
