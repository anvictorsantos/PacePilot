import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_FILTERS,
  ActivityFilter,
  ActivityFilterValue,
} from '@/modules/activities/domain/value-object/ActivityFilter'
import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'

describe('ActivityFilter', () => {
  it('reads an unknown filter as "everything" instead of failing', () => {
    expect(ActivityFilter.from('tempo').value).toBe(ActivityFilterValue.Tempo)
    expect(ActivityFilter.from('sprints').value).toBe(ActivityFilterValue.All)
    expect(ActivityFilter.from(null).isAll()).toBe(true)
  })

  it('refuses a value outside the enum when constructed directly', () => {
    expect(() => new ActivityFilter('sprints' as ActivityFilterValue)).toThrow(
      InvalidArgumentError,
    )
  })

  it('passes its wire value to the list endpoint', () => {
    expect(ActivityFilter.from('threshold').toQueryParam()).toBe('threshold')
    expect(ActivityFilter.from('all').toQueryParam()).toBe('all')
  })

  it('matches activities by type, and everything when all', () => {
    const tempo = ActivityFilter.from('tempo')
    expect(tempo.matches('tempo')).toBe(true)
    expect(tempo.matches('easy')).toBe(false)
    expect(tempo.matches(null)).toBe(false)
    expect(ActivityFilter.from('all').matches(null)).toBe(true)
  })

  it('renders one chip per filter, "all" first', () => {
    const chips = ActivityFilter.chips()
    expect(chips).toHaveLength(ACTIVITY_FILTERS.length)
    expect(chips[0]?.isAll()).toBe(true)
    expect(chips.map((chip) => chip.labelKey())).toContain(
      'landing.sections.activities.filter.recovery',
    )
  })
})
