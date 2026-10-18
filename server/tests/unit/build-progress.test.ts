import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildProgress } from '@/modules/progress/application/build-progress.ts'
import type { ProgressActivity } from '@/modules/progress/application/build-progress.ts'

const DAY = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

function run(daysAgoCount: number, pace = 330): ProgressActivity {
  return {
    date: daysAgo(daysAgoCount),
    distance_km: 5,
    avg_pace_sec_km: pace,
    avg_hr: 150,
    workout_type: 'easy',
    strava_activity_id: daysAgoCount,
  }
}

const GOAL = { preferred_days: ['Monday', 'Wednesday', 'Friday'], days_per_week: 3 }

describe('buildProgress', () => {
  it('reports nothing rather than a number the athlete has not earned', () => {
    // No activities at all: nothing to be consistent about, so `—` rather than 0%.
    assert.equal(buildProgress([], GOAL).goalProgress, null)
  })

  it('reports a real figure as soon as there is a completed run', () => {
    // CONTEXT.md asks for `null` under 14 days of history; the engine also
    // reports once something was completed, which is the behaviour preserved
    // here. Three runs in the last week is a real 25%, not an empty state.
    const view = buildProgress([run(1), run(3), run(5)], GOAL)
    assert.deepEqual(view.goalProgress, { pct: 25, planned: 12, completed: 3 })
  })

  it('reports zero rather than nothing once there is history to judge', () => {
    // 40 and 60 days ago: over 14 days of history, nothing in the last 28.
    const view = buildProgress([run(40), run(60)], GOAL)
    assert.deepEqual(view.goalProgress, { pct: 0, planned: 12, completed: 0 })
  })

  it('counts the planned slots from preferred_days', () => {
    const activities = [run(1), run(20), run(25)]
    const view = buildProgress(activities, GOAL)
    // 3 preferred days × 4 weeks = 12 planned; 3 completed inside 28d
    assert.deepEqual(view.goalProgress, { pct: 25, planned: 12, completed: 3 })
  })

  it('falls back to days_per_week when no preferred days are set', () => {
    const view = buildProgress([run(20), run(25)], { days_per_week: 4 })
    assert.equal(view.goalProgress?.planned, 16)
  })

  it('never reports progress when no days are planned at all', () => {
    assert.equal(buildProgress([run(20)], {}).goalProgress, null)
    assert.equal(buildProgress([run(20)], null).goalProgress, null)
  })

  it('ignores runs older than 28 days when counting completion', () => {
    const view = buildProgress([run(1), run(40), run(60)], GOAL)
    assert.equal(view.goalProgress?.completed, 1)
  })

  it('orders the best efforts by pace and keeps three', () => {
    const view = buildProgress(
      [run(1, 400), run(2, 300), run(3, 320), run(4, 290), run(5, 500)],
      GOAL,
    )
    assert.equal(view.records.length, 3)
    assert.deepEqual(
      view.records.map((r) => r.pace),
      [290, 300, 320],
    )
    // the identifier is what the UI links on
    assert.equal(view.records[0]?.id, 4)
  })

  it('reports totals and a pace series the charts can read', () => {
    const view = buildProgress([run(1), run(2)], GOAL)
    assert.equal(view.totalActivities, 2)
    assert.equal(view.totalDistance, 10)
    assert.equal(view.paceSeries.length, 2)
    assert.ok(view.trainingState)
    assert.ok(Array.isArray(view.volumeSeries))
  })

  it('survives activities with no distance or pace', () => {
    const sparse: ProgressActivity[] = [{ date: daysAgo(1), workout_type: 'easy' }]
    const view = buildProgress(sparse, GOAL)
    assert.equal(view.totalDistance, 0)
    assert.equal(view.paceSeries[0]?.pace, undefined)
    assert.equal(view.records[0]?.pace, undefined)
  })
})
