/**
 * The consent gate is the module's central rule: undecided and refused both mean
 * nothing is sent. The use cases are exercised against a recording tracker and a
 * repository stub, so the assertions are about what left the app, not about mocks.
 */
import { describe, expect, it } from 'vitest'

import { DecideAnalyticsConsent } from '@/modules/analytics/application/use-case/DecideAnalyticsConsent.ts'
import { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import { TrackPageView } from '@/modules/analytics/application/use-case/TrackPageView.ts'
import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import type {
  AnalyticsParams,
  AnalyticsTracker,
} from '@/modules/analytics/domain/service/analytics-tracker.ts'
import {
  AnalyticsConsent,
  type AnalyticsConsent as Consent,
} from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import type { AnalyticsEventName as EventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

/** A tracker that keeps what it was handed, so "nothing sent" is assertable. */
class RecordingTracker implements AnalyticsTracker {
  readonly events: Array<{ name: EventName; params: AnalyticsParams }> = []
  readonly views: string[] = []
  readonly consents: Consent[] = []

  setConsent(consent: Consent): void {
    this.consents.push(consent)
  }

  trackEvent(name: EventName, params: AnalyticsParams = {}): void {
    this.events.push({ name, params })
  }

  pageView(path: string): void {
    this.views.push(path)
  }
}

function consentStore(initial: Consent | null = null): AnalyticsConsentRepository {
  let value = initial
  return { read: () => value, write: (consent) => (value = consent) }
}

describe('TrackEvent', () => {
  it('sends when granted', () => {
    const sink = new RecordingTracker()
    new TrackEvent(sink, consentStore(AnalyticsConsent.Granted)).execute(
      AnalyticsEventName.StravaConnect,
    )

    expect(sink.events).toEqual([{ name: 'strava_connect', params: {} }])
  })

  it('sends nothing while undecided', () => {
    const sink = new RecordingTracker()
    new TrackEvent(sink, consentStore(null)).execute(AnalyticsEventName.Signup)

    expect(sink.events).toEqual([])
  })

  it('sends nothing when denied', () => {
    const sink = new RecordingTracker()
    new TrackEvent(sink, consentStore(AnalyticsConsent.Denied)).execute(AnalyticsEventName.Signup)

    expect(sink.events).toEqual([])
  })
})

describe('TrackPageView', () => {
  it('is gated on the same consent', () => {
    const sink = new RecordingTracker()
    new TrackPageView(sink, consentStore(AnalyticsConsent.Denied)).execute('/workout')
    new TrackPageView(sink, consentStore(AnalyticsConsent.Granted)).execute('/plan')

    expect(sink.views).toEqual(['/plan'])
  })
})

describe('DecideAnalyticsConsent', () => {
  it('stores a refusal instead of forgetting it', () => {
    const sink = new RecordingTracker()
    const store = consentStore()

    new DecideAnalyticsConsent(store, sink).execute(AnalyticsConsent.Denied)

    expect(store.read()).toBe(AnalyticsConsent.Denied)
    expect(sink.consents).toEqual([AnalyticsConsent.Denied])
  })
})
