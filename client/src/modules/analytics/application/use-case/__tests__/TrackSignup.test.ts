// The OAuth redirect carries no "new athlete" flag, so the once-only marker is
// the behaviour under test.
import { describe, expect, it, vi } from 'vitest'

import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import { TrackSignup } from '@/modules/analytics/application/use-case/TrackSignup.ts'
import type { SignupMarker } from '@/modules/analytics/domain/repository/signup-marker.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

function marker(sent = false): SignupMarker {
  let value = sent
  return { sent: () => value, remember: () => (value = true) }
}

/** `sent` stands for "consent allowed it out". */
function trackEvent(sent: boolean) {
  const execute = vi.fn(() => sent)
  return { execute, port: { execute } as unknown as TrackEvent }
}

describe('TrackSignup', () => {
  it('counts the first session on this browser', () => {
    const { execute, port } = trackEvent(true)
    const once = marker()

    new TrackSignup(once, port).execute()

    expect(execute).toHaveBeenCalledWith(AnalyticsEventName.Signup)
    expect(once.sent()).toBe(true)
  })

  it('stays quiet on every later session', () => {
    const { execute, port } = trackEvent(true)

    new TrackSignup(marker(true), port).execute()

    expect(execute).not.toHaveBeenCalled()
  })

  it('forgets nothing when consent refused the send', () => {
    const { execute, port } = trackEvent(false)
    const once = marker()

    new TrackSignup(once, port).execute()

    expect(execute).toHaveBeenCalledTimes(1)
    expect(once.sent()).toBe(false)
  })
})
