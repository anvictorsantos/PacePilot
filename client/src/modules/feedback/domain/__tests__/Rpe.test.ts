import { describe, expect, it } from 'vitest'

import {
  FeedbackStatus,
  isCompletedStatus,
  toFeedbackStatus,
} from '@/modules/feedback/domain/value-object/FeedbackStatus'
import { Rpe } from '@/modules/feedback/domain/value-object/Rpe'
import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'

describe('FeedbackStatus', () => {
  it('narrows the two outcomes the API accepts', () => {
    expect(toFeedbackStatus('completed')).toBe(FeedbackStatus.Completed)
    expect(toFeedbackStatus('skipped')).toBe(FeedbackStatus.Skipped)
    expect(toFeedbackStatus('abandoned')).toBeNull()
  })

  it('treats anything that is not an explicit skip as completed', () => {
    // CONTEXT.md §Implicit Skip: an absent entry is an inferred absence, not a skip.
    expect(isCompletedStatus('completed')).toBe(true)
    expect(isCompletedStatus(null)).toBe(true)
    expect(isCompletedStatus('skipped')).toBe(false)
  })
})

describe('Rpe', () => {
  it('accepts 1–10, including the string a native select hands back', () => {
    expect(Rpe.from(1)?.value).toBe(1)
    expect(Rpe.from('9')?.value).toBe(9)
    expect(Rpe.from(10)?.value).toBe(10)
  })

  it('reads an empty selection as no RPE rather than a zero', () => {
    expect(Rpe.from('')).toBeNull()
    expect(Rpe.from(null)).toBeNull()
    expect(Rpe.from(undefined)).toBeNull()
  })

  it('refuses a value outside the scale', () => {
    expect(() => new Rpe(0)).toThrow(InvalidArgumentError)
    expect(() => new Rpe(11)).toThrow(InvalidArgumentError)
    expect(() => new Rpe(4.5)).toThrow(InvalidArgumentError)
  })

  it('names the band each value falls in', () => {
    expect(Rpe.from(1)?.labelKey()).toBe('ui.rpe_label.very_easy')
    expect(Rpe.from(5)?.labelKey()).toBe('ui.rpe_label.moderate')
    expect(Rpe.from(8)?.labelKey()).toBe('ui.rpe_label.moderate_hard')
    expect(Rpe.from(9)?.labelKey()).toBe('ui.rpe_label.hard')
    expect(Rpe.from(10)?.labelKey()).toBe('ui.rpe_label.max')
  })

  it('flags the values the engine downgrades on (CONTEXT.md §Downgrade)', () => {
    expect(Rpe.from(7)?.isHigh()).toBe(false)
    expect(Rpe.from(8)?.isHigh()).toBe(true)
    expect(Rpe.from(10)?.isHigh()).toBe(true)
  })
})
