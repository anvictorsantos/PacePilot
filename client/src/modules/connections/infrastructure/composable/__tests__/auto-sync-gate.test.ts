import { describe, expect, it } from 'vitest'

import { AutoSyncGate } from '@/modules/connections/infrastructure/composable/auto-sync-gate.ts'

const MINUTE = 60_000
const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString()
}

describe('AutoSyncGate', () => {
  it('imports in a fresh session that has never synced', () => {
    expect(new AutoSyncGate().canAttempt(NOW, null)).toBe(true)
  })

  it('leaves a sync the server already covered alone', () => {
    expect(new AutoSyncGate().canAttempt(NOW, iso(-5 * MINUTE))).toBe(false)
  })

  it('imports once the watermark is older than the window', () => {
    expect(new AutoSyncGate().canAttempt(NOW, iso(-16 * MINUTE))).toBe(true)
  })

  it('spends one attempt per window even while the watermark stays old', () => {
    const gate = new AutoSyncGate()
    gate.markAttempt(NOW)
    expect(gate.canAttempt(NOW + MINUTE, iso(-60 * MINUTE))).toBe(false)
    expect(gate.canAttempt(NOW + 16 * MINUTE, iso(-60 * MINUTE))).toBe(true)
  })

  it('re-arms after the connection changed, whatever the earlier attempt said', () => {
    const gate = new AutoSyncGate()
    gate.markAttempt(NOW)
    expect(gate.canAttempt(NOW + MINUTE, iso(-60 * MINUTE))).toBe(false)

    // A link or a disconnect makes the earlier attempt irrelevant.
    gate.rearm()

    expect(gate.canAttempt(NOW + MINUTE, iso(-60 * MINUTE))).toBe(true)
  })

  it('imports when the watermark is unreadable rather than staying silent forever', () => {
    expect(new AutoSyncGate().canAttempt(NOW, 'not-a-date')).toBe(true)
  })
})
