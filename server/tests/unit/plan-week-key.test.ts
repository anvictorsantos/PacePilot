// The AI cache key's week segment must equal the Monday the plan writes into
// week[0].date. If these drift, every request misses the cache forever.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildWeekPlan, currentWeekKey } from '@/modules/training/application/plan.service.ts'

const STATE = {
  weekly: {
    distance7: 30, distance28: 90, runs7: 4,
    longRun7: 12, longRun28: 14, hardSessions7: 1, hardSessions14: 2,
  },
  trend: 'building', fatigueSignals: [], hasFatigueSignal: false,
}

function planMonday(today: Date): string {
  const week = buildWeekPlan(STATE as never, null, today)
  const first = week[0]
  assert.ok(first)
  return first.date
}

describe('currentWeekKey', () => {
  test('a mid-week date keys to that week’s Monday, exactly like the plan', () => {
    const wednesday = new Date('2026-10-28T12:00:00')
    assert.equal(currentWeekKey(wednesday), '2026-10-26')
    assert.equal(currentWeekKey(wednesday), planMonday(wednesday))
  })

  test('Sunday keys to the Monday that started that week, not the next one', () => {
    const sunday = new Date('2026-11-01T12:00:00')
    assert.equal(currentWeekKey(sunday), '2026-10-26')
    assert.equal(currentWeekKey(sunday), planMonday(sunday))
  })

  test('the following week is a different segment', () => {
    const wednesday = new Date('2026-10-28T12:00:00')
    const nextWednesday = new Date('2026-11-04T12:00:00')
    assert.notEqual(currentWeekKey(wednesday), currentWeekKey(nextWednesday))
    assert.equal(currentWeekKey(nextWednesday), planMonday(nextWednesday))
  })
})
