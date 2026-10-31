// Pins the selection rule: unread compares import time (`createdAt`), never start
// time, and `updatedAt` would light the bell on every enrichment.
import { describe, expect, it } from 'vitest'

import { ActivityReadFeed } from '@/modules/activities/domain/value-object/ActivityReadFeed'
import { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark'

interface Row {
  id: string
  date: string
  createdAt?: string | null
  updatedAt?: string | null
}

function row(id: string, date: string, createdAt?: string | null, updatedAt?: string | null): Row {
  const value: Row = { id, date }
  if (createdAt !== undefined) value.createdAt = createdAt
  if (updatedAt !== undefined) value.updatedAt = updatedAt
  return value
}

const LAST_LOOKED = ActivityReadWatermark.fromPrimitives('2026-10-28T08:00:00.000Z')
const IMPORTED_AT = '2026-10-28T09:00:04.000Z'

function ids(rows: readonly Row[]): string[] {
  return rows.map((entry) => entry.id)
}

describe('ActivityReadFeed', () => {
  it('lists an activity the sync imported even though it started before that sync', () => {
    const startedYesterday = row('yesterday', '2026-10-27T06:30:00.000Z', IMPORTED_AT, IMPORTED_AT)
    const feed = ActivityReadFeed.of([startedYesterday], LAST_LOOKED, 6)

    expect(ids(feed.unread)).toEqual(['yesterday'])
    expect(feed.hasUnread).toBe(true)
    expect(feed.unreadCount).toBe(1)
  })

  it('reads import time only, never the start time', () => {
    const feed = ActivityReadFeed.of(
      [
        row('ancient', '2024-01-01T07:00:00.000Z', '2026-10-28T09:10:00.000Z'),
        row('this-morning', '2026-10-28T08:30:00.000Z', IMPORTED_AT),
      ],
      LAST_LOOKED,
      6,
    )

    expect(ids(feed.unread)).toEqual(['ancient', 'this-morning'])
  })

  it('does not treat a re-imported correction as new', () => {
    // New only: a correction moves `updatedAt` on a row the athlete already had,
    // and re-lighting the bell would make every sync look like it found something.
    const corrected = row(
      'corrected',
      '2026-10-20T06:00:00.000Z',
      '2026-10-20T07:00:00.000Z',
      IMPORTED_AT,
    )
    const feed = ActivityReadFeed.of(
      [corrected],
      ActivityReadWatermark.fromPrimitives('2026-10-21T00:00:00.000Z'),
      6,
    )

    expect(feed.unread).toEqual([])
    expect(ids(feed.recent)).toEqual(['corrected'])
  })

  it('does not treat a row with no createdAt as new, however often it is rewritten', () => {
    // An enrichment write (laps, trophies) moves `updatedAt`; reading it would
    // light the bell every time a detail view touched an old row.
    const legacy = row('legacy', '2026-10-27T06:30:00.000Z', null, IMPORTED_AT)

    const feed = ActivityReadFeed.of([legacy], LAST_LOOKED, 6)

    expect(feed.unread).toEqual([])
    expect(ids(feed.recent)).toEqual(['legacy'])
  })

  it('never invents an import time', () => {
    const unknown = row('unknown', '2026-10-27T06:30:00.000Z')

    const feed = ActivityReadFeed.of([unknown], ActivityReadWatermark.never(), 6)

    expect(feed.unread).toEqual([])
    expect(ids(feed.recent)).toEqual(['unknown'])
  })

  it('treats an account that has never looked as having seen nothing', () => {
    const imported = row('first-import', '2026-10-27T06:30:00.000Z', IMPORTED_AT)

    expect(ids(ActivityReadFeed.of([imported], ActivityReadWatermark.never(), 6).unread)).toEqual([
      'first-import',
    ])
  })

  it('stops listing an activity once the watermark covers its import', () => {
    const imported = row('seen', '2026-10-27T06:30:00.000Z', IMPORTED_AT)
    const markedRead = ActivityReadWatermark.fromPrimitives(IMPORTED_AT)

    const feed = ActivityReadFeed.of([imported], markedRead, 6)

    expect(feed.unread).toEqual([])
    expect(feed.hasUnread).toBe(false)
    expect(ids(feed.recent)).toEqual(['seen'])
  })

  it('orders unread by import time, newest first', () => {
    const feed = ActivityReadFeed.of(
      [
        row('older', '2026-10-27T06:30:00.000Z', '2026-10-28T08:30:00.000Z'),
        row('older-still', '2026-10-26T06:30:00.000Z', '2026-10-28T08:10:00.000Z'),
        row('newer', '2026-10-28T06:30:00.000Z', '2026-10-28T09:30:00.000Z'),
      ],
      LAST_LOOKED,
      6,
    )

    expect(ids(feed.unread)).toEqual(['newer', 'older', 'older-still'])
  })

  it('caps what the panel lists while counting every unread row', () => {
    const rows = [
      row('one', '2026-10-28T05:00:00.000Z', '2026-10-28T09:00:00.000Z'),
      row('two', '2026-10-28T06:00:00.000Z', '2026-10-28T09:05:00.000Z'),
      row('three', '2026-10-28T07:00:00.000Z', '2026-10-28T09:10:00.000Z'),
    ]

    const feed = ActivityReadFeed.of(rows, LAST_LOOKED, 2)

    expect(ids(feed.unread)).toEqual(['three', 'two'])
    expect(feed.unreadCount).toBe(3)
    // "Mark all read" must cover the rows the cap kept off screen too.
    expect(feed.latestImportInstant?.toISOString()).toBe('2026-10-28T09:10:00.000Z')
  })

  it('still lists the newest activities when nothing is unread', () => {
    const feed = ActivityReadFeed.of(
      [
        row('monday', '2026-10-26T06:30:00.000Z', '2026-10-26T07:00:00.000Z'),
        row('tuesday', '2026-10-27T06:30:00.000Z', '2026-10-27T07:00:00.000Z'),
      ],
      ActivityReadWatermark.fromPrimitives('2026-10-28T00:00:00.000Z'),
      6,
    )

    expect(feed.unread).toEqual([])
    expect(ids(feed.recent)).toEqual(['tuesday', 'monday'])
  })
})
