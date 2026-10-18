import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import type {
  AnalyticsParams,
  AnalyticsTracker,
} from '@/modules/analytics/domain/service/analytics-tracker.ts'
import { isAnalyticsGranted } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

/**
 * Report a named interaction, but only with consent.
 *
 * The gate lives here rather than in the adapter so "denied means nothing leaves
 * the device" is one readable rule with a test, and the adapter stays a thin
 * transport that never has to re-ask the question. The boolean is for callers
 * that must only act on a hit that really went out — `TrackSignup` marks its
 * once-only flag on `true`, never on a refusal.
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
