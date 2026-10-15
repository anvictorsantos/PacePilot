import { describe, it, expect } from 'vitest'
import { activityTitle } from '@/utils/labels.ts'

describe('labels', () => {
  it('returns name when provided', () => {
    expect(activityTitle({ name: 'Tempo Run', workout_type: 'tempo' })).toBe('Tempo Run')
  })
  it('falls back to unknown title', () => {
    expect(activityTitle({})).toBeTruthy()
  })
})
