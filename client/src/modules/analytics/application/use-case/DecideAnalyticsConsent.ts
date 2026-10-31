import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import type { AnalyticsTracker } from '@/modules/analytics/domain/service/analytics-tracker.ts'
import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'

// A refusal is stored, not discarded: without it the banner returns on the next
// visit and re-asks a question the athlete already answered.
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
