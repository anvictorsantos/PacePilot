import { describe, expect, it } from 'vitest'

import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey'
import { Uuid } from '@/modules/shared/domain/value-object/Uuid'

describe('LocalDateKey', () => {
  it('reads the local calendar day, not the UTC one', () => {
    // 00:30 in a UTC+1 zone is still the same local day; toISOString would say
    // the day before, which is the bug this value object exists to prevent.
    const lateNight = new Date(2026, 9, 15, 0, 30)
    expect(LocalDateKey.fromDate(lateNight).value).toBe('2026-10-15')
  })

  it('accepts a date-only string, a Date and a number', () => {
    expect(LocalDateKey.from('2026-10-05').value).toBe('2026-10-05')
    expect(LocalDateKey.from(new Date(2026, 9, 5)).value).toBe('2026-10-05')
    expect(LocalDateKey.from(new Date(2026, 9, 5).getTime()).value).toBe('2026-10-05')
  })

  it('normalises an ISO timestamp to its local day', () => {
    expect(LocalDateKey.from('2026-10-05T12:00:00.000Z').value).toBe('2026-10-05')
  })

  it('keeps the leading date of an unparseable value so keys stay comparable', () => {
    expect(LocalDateKey.from('2026-10-05-ish').value).toBe('2026-10-05')
    expect(LocalDateKey.from('').value).toBe('')
  })

  it('compares days', () => {
    const monday = LocalDateKey.from('2026-10-05')
    const tuesday = LocalDateKey.from('2026-10-06')
    expect(monday.isBefore(tuesday)).toBe(true)
    expect(tuesday.isAfter(monday)).toBe(true)
    expect(monday.equals(LocalDateKey.from('2026-10-05'))).toBe(true)
  })

  it('anchors to midday so a date string never lands on the previous day', () => {
    expect(LocalDateKey.from('2026-10-05').toDate().getDate()).toBe(5)
  })

  it('reports today', () => {
    expect(LocalDateKey.today().value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('Uuid', () => {
  it('generates a valid identifier', () => {
    expect(() => Uuid.random()).not.toThrow()
    expect(Uuid.random().value).toHaveLength(36)
  })

  it('refuses a malformed identifier', () => {
    expect(() => new Uuid('not-a-uuid')).toThrow(InvalidArgumentError)
  })
})
