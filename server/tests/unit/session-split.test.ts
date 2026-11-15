import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { splitSession, structureFor } from '@/modules/training/domain/templates.ts'

const EASY = 365 // sec/km — avgPace28 6:00 + 5

describe('splitSession', () => {
  test('turns the minute prescription into distance at easy pace', () => {
    const split = splitSession(structureFor('tempo'), EASY, 7)
    assert.equal(split.warmup_km, 2.0) // 12 min
    assert.equal(split.cooldown_km, 1.6) // 10 min
    assert.equal(split.main_km, 3.4)
  })

  test('segments add up to the session distance', () => {
    for (const type of ['recovery', 'easy', 'long', 'steady', 'tempo', 'threshold', 'interval']) {
      const total = type === 'long' ? 12 : type === 'recovery' ? 4 : type === 'easy' ? 6 : 8
      const split = splitSession(structureFor(type), EASY, total)
      const sum = split.warmup_km + split.main_km + split.cooldown_km
      assert.ok(Math.abs(sum - total) < 0.1, `${type}: ${sum} vs ${total}`)
    }
  })

  test('both ends shrink instead of eating the main block', () => {
    const split = splitSession(structureFor('tempo'), EASY, 1)
    assert.equal(split.warmup_km, 0.3)
    assert.equal(split.cooldown_km, 0.2)
    assert.equal(split.main_km, 0.5)
  })

  test('ignores text that does not start with minutes', () => {
    const split = splitSession({ warmup: 'strides only', main: 'x', cooldown: 'none' }, EASY, 6)
    assert.equal(split.warmup_km, 0)
    assert.equal(split.cooldown_km, 0)
    assert.equal(split.main_km, 6)
  })
})
