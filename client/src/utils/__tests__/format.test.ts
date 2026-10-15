import { describe, it, expect } from 'vitest'
import * as fmt from '@/utils/format.ts'

describe('format', () => {
  it('formatPace', () => {
    expect(fmt.formatPace(120)).toBe('2:00 /km')
  })
  it('formatDistanceKm', () => {
    expect(fmt.formatDistanceKm(5)).toContain('5.0')
  })
  it('formatDuration', () => {
    expect(fmt.formatDuration(0)).toBe('0:00')
  })
  it('formatShortTime', () => {
    expect(fmt.formatShortTime(65)).toBe('1:05')
  })
})
