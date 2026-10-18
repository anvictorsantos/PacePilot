import { describe, expect, it } from 'vitest'

import { WeekMeta } from '@/modules/training/domain/value-object/WeekMeta'

describe('WeekMeta', () => {
  it('reads the wire shape', () => {
    const meta = WeekMeta.from({ currentWeek: 6, totalWeeks: 12 })
    expect(meta.currentWeek).toBe(6)
    expect(meta.totalWeeks).toBe(12)
  })

  it('survives a missing or empty payload', () => {
    expect(WeekMeta.from(null).progressPct()).toBe(0)
    expect(WeekMeta.from({}).nextWeek()).toBe(1)
  })

  it('reports progress through the programme', () => {
    expect(WeekMeta.from({ currentWeek: 6, totalWeeks: 12 }).progressPct()).toBe(50)
    expect(WeekMeta.from({ currentWeek: 1, totalWeeks: 12 }).progressPct()).toBe(8)
  })

  it('never runs past the programme', () => {
    const last = WeekMeta.from({ currentWeek: 12, totalWeeks: 12 })
    expect(last.nextWeek()).toBe(12)
    expect(last.isComplete()).toBe(true)
  })

  it('round-trips its primitives', () => {
    const primitives = { currentWeek: 3, totalWeeks: 12 }
    expect(WeekMeta.from(primitives).toPrimitives()).toEqual(primitives)
  })
})
