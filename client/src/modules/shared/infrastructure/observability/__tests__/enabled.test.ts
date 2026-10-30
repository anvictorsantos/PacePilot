import { describe, expect, it } from 'vitest'

import { observabilityEnabled } from '@/modules/shared/infrastructure/observability/enabled.ts'

describe('observabilityEnabled', () => {
  it('reports from a production build without being asked', () => {
    expect(observabilityEnabled({ prod: true })).toBe(true)
    expect(observabilityEnabled({ prod: true, force: 'false' })).toBe(true)
  })

  it('stays silent in a development build', () => {
    expect(observabilityEnabled({ prod: false })).toBe(false)
    expect(observabilityEnabled({ prod: false, force: '' })).toBe(false)
    expect(observabilityEnabled({ prod: false, force: '1' })).toBe(false)
  })

  it('reports from a development build only when forced', () => {
    expect(observabilityEnabled({ prod: false, force: 'true' })).toBe(true)
  })
})
