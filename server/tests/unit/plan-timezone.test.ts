import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWeekPlan,
  currentWeekKey,
} from '@/modules/training/application/plan.service.ts'
import { getWeekMeta } from '@/modules/training/domain/weekMeta.ts'
import { calcTrainingState } from '@/modules/training/domain/training-state.ts'

const goal = {
  goal_type: '5K',
  days_per_week: 4,
  preferred_days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'],
}
const state = calcTrainingState([])

test('the week follows the athlete zone, not the server clock', () => {
  // 02:00 UTC on the 15th is still the 14th in São Paulo.
  const instant = new Date('2026-11-15T02:00:00Z')
  const week = buildWeekPlan(state, goal, instant, [], [], 'America/Sao_Paulo')

  assert.equal(week.length, 7)
  assert.equal(week.find((day) => day.isToday)?.date, '2026-11-14')
  assert.equal(week[0]?.date, '2026-11-09') // Monday of that local week
  assert.equal(week[6]?.date, '2026-11-15')
})

test('the AI cache week key uses the same Monday', () => {
  const instant = new Date('2026-11-15T02:00:00Z')
  assert.equal(currentWeekKey(instant, 'America/Sao_Paulo'), '2026-11-09')
})

test('week meta counts whole days in the athlete zone', () => {
  // The same start/today pair is week 2 in São Paulo and week 1 in Lisbon.
  const start = '2026-11-09T01:00:00Z'
  const today = new Date('2026-11-15T12:00:00Z')
  const goalWeek = { goal_date: '2026-12-06' }
  const athlete = { goalSetAt: start }

  assert.equal(
    getWeekMeta([], goalWeek, athlete, today, 'America/Sao_Paulo').currentWeek,
    2,
  )
  assert.equal(
    getWeekMeta([], goalWeek, athlete, today, 'Europe/Lisbon').currentWeek,
    1,
  )
})
