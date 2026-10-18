import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import type { AnalyticsTracker } from '@/modules/analytics/domain/service/analytics-tracker.ts'
import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'

/**
 * Record the athlete's answer and mirror it into Consent Mode.
 *
 * A refusal is stored, not discarded: without it the banner would return on the
 * next visit and re-ask a question the athlete already answered.
 */
export class DecideAnalyticsConsent {
  constructor(
    private readonly consentRepository: AnalyticsConsentRepository,
    private readonly tracker: AnalyticsTracker,
  ) {}

  execute(consent: AnalyticsConsent): void {
    this.consentRepository.write(consent)
    this.tracker.setConsent(consent)
  }
}
