import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

/** Values a GA4 event may carry. Deliberately narrow: no objects, no arrays. */
export type AnalyticsParamValue = string | number | boolean

// Never an identifier (no email, no Strava id, no athlete id): GA4 forbids
// personal data, and the funnel only needs behaviour (CONTEXT.md §Analytics).
export type AnalyticsParams = Record<string, AnalyticsParamValue>

// Port for the measurement platform; the adapter is GA4 via `gtag`, so a test
// doubles this instead of reaching into the page. Consent gating lives in TrackEvent.
export interface AnalyticsTracker {
  /** Mirror the athlete's decision into Consent Mode v2. */
  setConsent(consent: AnalyticsConsent): void
  trackEvent(name: AnalyticsEventName, params?: AnalyticsParams): void
  /** Report one navigation. `path` only — never the query string. */
  pageView(path: string): void
}
