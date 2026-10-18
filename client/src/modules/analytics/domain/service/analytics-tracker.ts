import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

/** Values a GA4 event may carry. Deliberately narrow: no objects, no arrays. */
export type AnalyticsParamValue = string | number | boolean

/**
 * Event parameters. Never an identifier: no email, no Strava id, no athlete id —
 * GA4 forbids personal data, and the funnel only needs behaviour (CONTEXT.md
 * §Analytics).
 */
export type AnalyticsParams = Record<string, AnalyticsParamValue>

/**
 * Port for the measurement platform. The adapter is GA4 through `gtag`; the
 * domain knows neither the measurement id nor `window`, so a test doubles this
 * and nothing has to reach into the page.
 *
 * Gating on consent is not this port's job — `TrackEvent` decides, so a tracker
 * that is asked has already been allowed to send.
 */
export interface AnalyticsTracker {
  /** Mirror the athlete's decision into Consent Mode v2. */
  setConsent(consent: AnalyticsConsent): void
  /** Report one named interaction. */
  trackEvent(name: AnalyticsEventName, params?: AnalyticsParams): void
  /** Report one navigation. `path` only — never the query string. */
  pageView(path: string): void
}
