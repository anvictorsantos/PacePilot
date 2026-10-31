import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import type {
  AnalyticsParams,
  AnalyticsTracker,
} from '@/modules/analytics/domain/service/analytics-tracker.ts'
import { isAnalyticsGranted } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

/**
 * Consent gate lives here, not in the adapter, so "denied means nothing leaves the
 * device" is one rule with a test. Returns whether the event really went out.
 */
export class TrackEvent {
  constructor(
    private readonly tracker: AnalyticsTracker,
    private readonly consentRepository: AnalyticsConsentRepository,
  ) {}

  execute(name: AnalyticsEventName, params: AnalyticsParams = {}): boolean {
    if (!isAnalyticsGranted(this.consentRepository.read())) return false
    this.tracker.trackEvent(name, params)
    return true
  }
}
