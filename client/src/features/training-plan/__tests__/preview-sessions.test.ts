import { describe, expect, it } from 'vitest'

import {
  PREVIEW_SESSION_LIMIT,
  previewSessions,
} from '@/features/training-plan/preview-sessions.ts'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'

function day(date: string, type: string, distanceKm: number | null = 6): PlanDay {
  return { date, workout: { type, distance_km: distanceKm } }
}

describe('previewSessions', () => {
  it('leads with the long run, then quality in date order, capped at three', () => {
    const week = [
      day('2026-11-02', 'easy'),
      day('2026-11-04', 'tempo'),
      day('2026-11-07', 'long', 21),
      day('2026-11-03', 'interval'),
      day('2026-11-05', 'threshold'),
      day('2026-11-06', 'easy'),
    ]
    const sessions = previewSessions(week)
    expect(sessions.map((s) => s.type)).toEqual(['long', 'interval', 'tempo'])
    expect(sessions).toHaveLength(PREVIEW_SESSION_LIMIT)
    expect(sessions[0]?.distanceKm).toBe(21)
  })

  it('never turns a rest day into a card', () => {
    const week = [day('2026-11-02', 'rest', null), day('2026-11-03', 'easy')]
    expect(previewSessions(week).map((s) => s.type)).toEqual(['easy'])
  })

  it('fills the row with easy sessions when the week has no quality work', () => {
    const week = [
      day('2026-11-03', 'easy'),
      day('2026-11-07', 'long', 12),
      day('2026-11-05', 'recovery', 4),
    ]
    expect(previewSessions(week).map((s) => s.type)).toEqual(['long', 'easy', 'recovery'])
  })

  it('respects a smaller limit and an absent week', () => {
    const week = [day('2026-11-07', 'long', 12), day('2026-11-03', 'easy')]
    expect(previewSessions(week, 1).map((s) => s.type)).toEqual(['long'])
    expect(previewSessions(null)).toEqual([])
    expect(previewSessions([])).toEqual([])
  })

  it('keeps the wire distance untouched so the view formats it once', () => {
    const [session] = previewSessions([day('2026-11-07', 'long', 21.1)])
    expect(session).toEqual({ date: '2026-11-07', type: 'long', distanceKm: 21.1 })
  })
})
