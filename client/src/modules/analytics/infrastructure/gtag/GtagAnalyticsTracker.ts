import type {
  AnalyticsParams,
  AnalyticsTracker,
} from '@/modules/analytics/domain/service/analytics-tracker.ts'
import {
  AnalyticsConsent,
  type AnalyticsConsent as Consent,
} from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import type { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import {
  gtag,
  installGtagStub,
  loadGtagScript,
} from '@/modules/analytics/infrastructure/gtag/dataLayer.ts'

/** Consent Mode v2 signals. This app measures only; the ads signals stay denied. */
type ConsentSignal = 'analytics_storage'

// GA4 adapter: `send_page_view` off so the router owns page views (no double
// count on first load), and the denied consent default must be queued pre-script.
export class GtagAnalyticsTracker implements AnalyticsTracker {
  constructor(
    private readonly measurementId: string,
    private readonly debug = false,
  ) {
    installGtagStub()
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
    gtag('js', new Date())
    gtag('config', measurementId, { send_page_view: false, debug_mode: this.debug })
  }

  // Script is fetched on the first granted consent, never before: 160 kB of
  // third-party JS would compete with the LCP, and an unanswered visitor sends nothing.
  setConsent(consent: Consent): void {
    if (consent === AnalyticsConsent.Granted) loadGtagScript(this.measurementId)
    this.consentUpdate(consent === AnalyticsConsent.Granted ? 'granted' : 'denied')
  }

  trackEvent(name: AnalyticsEventName, params: AnalyticsParams = {}): void {
    gtag('event', name, params)
  }

  pageView(path: string): void {
    gtag('event', 'page_view', {
      page_path: path,
      page_location: `${window.location.origin}${path}`,
      page_title: document.title,
    })
  }

  private consentUpdate(state: 'granted' | 'denied'): void {
    const signals: Record<ConsentSignal, 'granted' | 'denied'> = { analytics_storage: state }
    gtag('consent', 'update', signals)
  }
}
