import type {
  AnalyticsParams,
  AnalyticsTracker,
} from '@/modules/analytics/domain/service/analytics-tracker.ts'
import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

/**
 * The tracker used when no measurement id is configured.
 *
 * A Null Object rather than a nullable dependency: every call site keeps one
 * shape, and "analytics is off" is a decision the composition root makes once
 * instead of a check repeated at each event.
 */
export class NoopAnalyticsTracker implements AnalyticsTracker {
  setConsent(_consent: AnalyticsConsent): void {}
  trackEvent(_name: AnalyticsEventName, _params: AnalyticsParams = {}): void {}
  pageView(_path: string): void {}
}
