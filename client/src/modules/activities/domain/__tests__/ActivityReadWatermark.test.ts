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

  it('stamps the newest import and never the browser clock', () => {
    // A fast browser clock put the watermark in the future and swallowed every
    // activity imported in that window — the incident's own failure, re-created
    // by skew. The instant to stamp is the newest import, full stop.
    const latestImport = new Date('2026-10-28T09:00:30.000Z')

    const stamped = ActivityReadWatermark.covering([latestImport, null])

    expect(stamped.toPrimitives()).toBe('2026-10-28T09:00:30.000Z')
  })

  it('leaves a later import unread, however the browser clock runs', () => {
    const latestImport = new Date('2026-10-28T09:00:30.000Z')
    const stamped = ActivityReadWatermark.covering([latestImport])

    // Imported a second after the athlete marked the feed read: still new,
    // even though the browser clock claims to be hours ahead.
    expect(stamped.covers(new Date('2026-10-28T09:00:31.000Z'))).toBe(false)
    expect(stamped.covers(latestImport)).toBe(true)
  })

  it('takes the newest instant when several are passed', () => {
    const stamped = ActivityReadWatermark.covering([
      new Date('2026-10-28T08:00:00.000Z'),
      new Date('2026-10-28T09:00:00.000Z'),
      null,
    ])

    expect(stamped.toPrimitives()).toBe('2026-10-28T09:00:00.000Z')
  })

  it('stamps nothing when there is nothing to cover', () => {
    // "Never looked" is honest; a clock reading would claim the athlete had.
    expect(ActivityReadWatermark.covering([]).isNever()).toBe(true)
    expect(ActivityReadWatermark.covering([null, undefined]).isNever()).toBe(true)
  })
})
