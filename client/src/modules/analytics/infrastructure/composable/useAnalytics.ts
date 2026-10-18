import type { AnalyticsParams } from '@/modules/analytics/domain/service/analytics-tracker.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { analyticsModule } from '@/modules/analytics/infrastructure/container/analytics-container.ts'

/**
 * Vue adapter for the analytics module.
 *
 * Every rule — the consent gate, the once-only signup, the path-only page view —
 * lives in `modules/analytics/`; this is the projection a component or the router
 * calls, and it decides nothing on its own.
 */
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
