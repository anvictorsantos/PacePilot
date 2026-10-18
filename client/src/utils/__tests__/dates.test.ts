import { describe, it, expect } from 'vitest'

import { localDateKey, toLocalDateKey } from '@/utils/dates.ts'

describe('dates', () => {
  it('localDateKey formats', () => {
    const d = new Date(2026, 9, 15)
    expect(localDateKey(d)).toBe('2026-10-15')
  })
  it('toLocalDateKey valid', () => {
    expect(toLocalDateKey('2026-10-05')).toBe('2026-10-05')
  })
  it('toLocalDateKey invalid falls back', () => {
    expect(toLocalDateKey('bad')).toBe('bad'.slice(0, 10))
  })
})
