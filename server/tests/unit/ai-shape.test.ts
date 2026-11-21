import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { applyAiShape, type AiWeekShape } from '@/modules/training/domain/aiShape.ts'
import type { ProgrammeWeek, SessionRole } from '@/modules/training/domain/programme.ts'
import { parseCoachingOutput } from '@/modules/ai/infrastructure/coaching-output.ts'
import type { AiWeekInput } from '@/modules/ai/domain/coaching-contract.ts'

function programme(roles: SessionRole[]): ProgrammeWeek {
  return {
    roles,
    qualityByIndex: roles.map((r, i) => (r === 'quality' ? (i % 2 ? 'interval' : 'tempo') : null)),
    longRunTargetKm: 12,
    longRunKm: 12,
    easyKm: 6,
    phase: 'base',
    qualityTypes: ['tempo', 'interval'],
    cutback: false,
    taper: false,
    weeksOut: 6,
    notes: [],
  }
}

const shape = (days: SessionRole[]): AiWeekShape => ({ days })

describe('applyAiShape', () => {
  test('accepts lightening a quality day', () => {
    const out = applyAiShape(programme(['easy', 'quality', 'easy', 'quality', 'easy', 'long', 'rest']), shape(['easy', 'easy', 'easy', 'quality', 'easy', 'long', 'rest']))
    assert.deepEqual(out?.programme.roles, ['easy', 'easy', 'easy', 'quality', 'easy', 'long', 'rest'])
    assert.deepEqual(out?.adjusted, [{ dayIndex: 1, from: 'quality', to: 'easy' }])
  })

  test('rejects adding a quality day', () => {
    assert.equal(applyAiShape(programme(['easy', 'easy', 'easy', 'easy', 'easy', 'long', 'rest']), shape(['easy', 'quality', 'easy', 'easy', 'easy', 'long', 'rest'])), null)
  })

  test('rejects creating a session on a rest day', () => {
    assert.equal(applyAiShape(programme(['easy', 'easy', 'easy', 'easy', 'easy', 'long', 'rest']), shape(['easy', 'easy', 'easy', 'easy', 'easy', 'long', 'easy'])), null)
  })

  test('rejects placing the long run on another day', () => {
    const out = applyAiShape(programme(['easy', 'easy', 'easy', 'easy', 'easy', 'long', 'rest']), shape(['long', 'easy', 'easy', 'easy', 'easy', 'easy', 'rest']))
    assert.equal(out?.programme.roles[0], 'easy')
    assert.equal(out?.programme.roles[5], 'easy', 'lightening the long run is allowed')
  })

  test('rejects a malformed shape', () => {
    assert.equal(applyAiShape(programme(['easy', 'easy', 'easy', 'easy', 'easy', 'long', 'rest']), { days: ['easy'] } as AiWeekShape), null)
  })

  test('returns null when nothing changes', () => {
    const p = programme(['easy', 'quality', 'easy', 'quality', 'easy', 'long', 'rest'])
    assert.equal(applyAiShape(p, shape(p.roles)), null)
  })
})

describe('parseCoachingOutput weekShape', () => {
  const weekDays = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-01-0${i + 1}`,
    workout: { type: i === 6 ? 'rest' : 'easy' },
  }))
  const input: AiWeekInput = {
    athleteId: 'a', state: {}, goal: {}, week: weekDays, weekKey: '2026-01-01', locale: 'en',
  }

  test('carries a seven-entry shape', () => {
    const content = JSON.stringify({ weekShape: ['easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'rest'] })
    const parsed = parseCoachingOutput(content, input)
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.ok && parsed.shape, { days: ['easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'rest'] })
  })

  test('drops an unknown role without failing the copy', () => {
    const content = JSON.stringify({ weekExplanations: ['x'], weekShape: ['easy', 'hard', 'easy', 'easy', 'easy', 'easy', 'rest'] })
    const parsed = parseCoachingOutput(content, input)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.ok && parsed.shape, null)
  })
})
