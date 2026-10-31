import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { feedbackSchema } from '@/modules/training/infrastructure/schemas/feedback.ts'
import { MAX_FEEDBACK_CHARS } from '@/modules/ai/domain/coaching-contract.ts'

const base = { date: '2026-10-20', rpe: 5, status: 'completed' }

describe('feedback schema — note budget', () => {
  test('the storage cap is the prompt cap, not a separate number', () => {
    // The prompt slices every note at MAX_FEEDBACK_CHARS; accepting more here
    // would silently drop text the athlete believed was saved.
    assert.equal(MAX_FEEDBACK_CHARS, 240)
  })

  test('accepts a note exactly at the cap', () => {
    const note = 'a'.repeat(MAX_FEEDBACK_CHARS)
    assert.equal(feedbackSchema.safeParse({ ...base, note }).success, true)
    assert.equal(feedbackSchema.safeParse({ ...base, notes: note }).success, true)
  })

  test('rejects a note one character over the cap, under either spelling', () => {
    const note = 'a'.repeat(MAX_FEEDBACK_CHARS + 1)
    assert.equal(feedbackSchema.safeParse({ ...base, note }).success, false)
    assert.equal(feedbackSchema.safeParse({ ...base, notes: note }).success, false)
  })

  test('a note stays optional', () => {
    const parsed = feedbackSchema.safeParse(base)
    assert.equal(parsed.success, true)
    assert.equal(parsed.success && parsed.data.note, undefined)
  })
})
