import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildPreviewWeek, nextWeekAnchor } from '@/modules/training/application/plan.service.ts'

const TODAY = new Date('2026-10-24T12:00:00')

const FIT = {
  weekly: {
    distance7: 38, distance28: 120, runs7: 5,
    longRun7: 18, longRun28: 20, hardSessions7: 1, hardSessions14: 2,
  },
  trend: 'building', fatigueSignals: [], hasFatigueSignal: false,
}

const goalIn = (iso: string) => ({
  goal_type: 'marathon',
  goal_date: iso,
  days_per_week: 5,
  preferred_days: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
})

describe('nextWeekAnchor', () => {
  test('lands on the same weekday next week, at midday', () => {
    const anchor = nextWeekAnchor(TODAY)
    assert.equal(anchor.getDay(), TODAY.getDay())
    assert.equal(anchor.getHours(), 12)
    assert.equal(
      Math.round((anchor.getTime() - TODAY.getTime()) / 86400000),
      7,
    )
  })
})

describe('buildPreviewWeek', () => {
  test('returns the seven days of the following Mon–Sun week', () => {
    const week = buildPreviewWeek(FIT as never, goalIn('2027-03-01'), TODAY)
    assert.ok(week)
    assert.equal(week.length, 7)
    assert.deepEqual(
      week.map(d => d.date),
      ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'],
    )
  })

  test('is programme-only: no isToday, no actuals, no adapted or skipped status', () => {
    const week = buildPreviewWeek(FIT as never, goalIn('2027-03-01'), TODAY)
    assert.ok(week)
    for (const day of week) {
      assert.equal(day.isToday, false, `${day.date} must not claim to be today`)
      assert.equal(day.actual, undefined)
      assert.equal(day.workout.status, 'planned')
      assert.equal(day.workout.originalType, undefined)
      assert.equal(day.workout.reason, undefined)
    }
  })

  test('carries the client-facing role keys, not English sentences', () => {
    const week = buildPreviewWeek(FIT as never, goalIn('2027-03-01'), TODAY)
    assert.ok(week)
    const longDay = week.find(d => d.workout.type === 'long')
    assert.ok(longDay, 'a marathon programme must plan a long run')
    assert.match(String(longDay.programmeRole), /^role_/)
    assert.doesNotMatch(String(longDay.programmeRole), /\s/)
  })

  test('a race that has already happened leaves nothing to preview', () => {
    assert.equal(buildPreviewWeek(FIT as never, goalIn('2026-10-25'), TODAY), null)
  })

  test('a race inside the preview week still previews that week', () => {
    const week = buildPreviewWeek(FIT as never, goalIn('2026-10-28'), TODAY)
    assert.ok(week, 'the race week itself is still next week')
    assert.ok(week.some(d => d.date === '2026-10-28'))
  })

  test('general fitness with a history gets a programme week too', () => {
    const week = buildPreviewWeek(FIT as never, { goal_type: null, goal_date: null }, TODAY)
    assert.ok(week)
    assert.equal(week.length, 7)
  })
})
