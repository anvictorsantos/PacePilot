import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import type { AnalyticsTracker } from '@/modules/analytics/domain/service/analytics-tracker.ts'
import { isAnalyticsGranted } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'

/**
 * Gated on consent like `TrackEvent`. The caller passes the router's path only:
 * the query string can carry a Strava `next=` target or an OAuth error.
 */
export class TrackPageView {
  constructor(
    private readonly tracker: AnalyticsTracker,
    private readonly consentRepository: AnalyticsConsentRepository,
  ) {}

  execute(path: string): void {
    if (!isAnalyticsGranted(this.consentRepository.read())) return
    this.tracker.pageView(path)
  }
}
