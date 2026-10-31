import type { AnalyticsParams } from '@/modules/analytics/domain/service/analytics-tracker.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { analyticsModule } from '@/modules/analytics/infrastructure/container/analytics-container.ts'

// Vue projection over the analytics use cases; every rule lives in `modules/analytics/`.
export function useAnalytics() {
  function trackEvent(name: AnalyticsEventName, params: AnalyticsParams = {}): void {
    analyticsModule.trackEvent.execute(name, params)
  }

  /** A router path. Never pass `to.fullPath`: the query string can carry a `next=` target. */
  function trackPageView(path: string): void {
    analyticsModule.trackPageView.execute(path)
  }

  function trackSignup(): void {
    analyticsModule.trackSignup.execute()
  }

  return { trackEvent, trackPageView, trackSignup }
}
