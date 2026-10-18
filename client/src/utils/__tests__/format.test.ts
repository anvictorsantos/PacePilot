import { describe, it, expect } from 'vitest'
import * as fmt from '@/utils/format.ts'

describe('format', () => {
  it('formatPace', () => {
    expect(fmt.formatPace(120)).toBe('2:00 /km')
  })
  it('formatDistanceKm', () => {
    expect(fmt.formatDistanceKm(5)).toContain('5.0')
  })
  it('formatPlanDistance', () => {
    expect(fmt.formatPlanDistance(6)).toBe('6 km')
    expect(fmt.formatPlanDistance(6.5)).toBe('6.5 km')
    expect(fmt.formatPlanDistance(null)).toBe('—')
    expect(fmt.formatPlanDistance(undefined)).toBe('—')
  })
  it('formatDuration', () => {
    expect(fmt.formatDuration(0)).toBe('0:00')
  })
  it('formatShortTime', () => {
    expect(fmt.formatShortTime(65)).toBe('1:05')
  })
})
