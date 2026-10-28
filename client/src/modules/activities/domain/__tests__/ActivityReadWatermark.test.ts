/**
 * The read watermark: the instant an account last looked at the feed. It is a
 * value, so "never looked" and "looked at 09:00" are two distinct answers and a
 * corrupt stored value degrades to "never looked" rather than to "now" — the
 * second would silently swallow the next import.
 */
import { describe, expect, it } from 'vitest'

import { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark'

describe('ActivityReadWatermark', () => {
  it('reads a stored instant back', () => {
    const watermark = ActivityReadWatermark.fromPrimitives('2026-10-28T08:00:00.000Z')

    expect(watermark.instant?.toISOString()).toBe('2026-10-28T08:00:00.000Z')
    expect(watermark.isNever()).toBe(false)
    expect(watermark.toPrimitives()).toBe('2026-10-28T08:00:00.000Z')
  })

  it('treats a missing or corrupt value as never looked', () => {
    for (const value of [null, undefined, '', 'yesterday']) {
      const watermark = ActivityReadWatermark.fromPrimitives(value)
      expect(watermark.isNever()).toBe(true)
      expect(watermark.toPrimitives()).toBeNull()
    }
  })

  it('covers an instant it is at or past, and only then', () => {
    const watermark = ActivityReadWatermark.fromPrimitives('2026-10-28T08:00:00.000Z')

    expect(watermark.covers(new Date('2026-10-28T07:59:59.999Z'))).toBe(true)
    expect(watermark.covers(new Date('2026-10-28T08:00:00.000Z'))).toBe(true)
    expect(watermark.covers(new Date('2026-10-28T08:00:00.001Z'))).toBe(false)
    expect(watermark.covers(null)).toBe(false)
  })

  it('never covers anything', () => {
    expect(ActivityReadWatermark.never().covers(new Date())).toBe(false)
    expect(ActivityReadWatermark.never().covers(null)).toBe(false)
  })

  it('stamps now, so a mark-all-read cannot swallow an import the clock ran behind', () => {
    const now = new Date('2026-10-28T09:00:00.000Z')
    // Server clock ahead of the browser: the newest row is stamped later.
    const latestImport = new Date('2026-10-28T09:00:30.000Z')

    const stamped = ActivityReadWatermark.covering([latestImport, null], now)

    expect(stamped.toPrimitives()).toBe('2026-10-28T09:00:30.000Z')
  })

  it('stamps now when it is the later instant', () => {
    const now = new Date('2026-10-28T09:10:00.000Z')
    const latestImport = new Date('2026-10-28T09:00:30.000Z')

    expect(ActivityReadWatermark.covering([latestImport], now).toPrimitives()).toBe(
      '2026-10-28T09:10:00.000Z',
    )
  })

  it('stamps now when there is nothing to cover', () => {
    const now = new Date('2026-10-28T09:10:00.000Z')

    expect(ActivityReadWatermark.covering([], now).toPrimitives()).toBe('2026-10-28T09:10:00.000Z')
  })
})
