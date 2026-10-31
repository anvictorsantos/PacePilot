import type {
  AnalyticsParams,
  AnalyticsTracker,
} from '@/modules/analytics/domain/service/analytics-tracker.ts'
import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

// Used when no measurement id is configured. A Null Object rather than a
// nullable dependency, so call sites keep one shape and "off" is decided once.
export class NoopAnalyticsTracker implements AnalyticsTracker {
  setConsent(_consent: AnalyticsConsent): void {}
  trackEvent(_name: AnalyticsEventName, _params: AnalyticsParams = {}): void {}
  pageView(_path: string): void {}
}
