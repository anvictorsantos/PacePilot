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

/**
 * The GA4 adapter: `gtag` with `send_page_view` off, so the router owns page
 * views and the first load is not counted twice by the tag and the router.
 *
 * The constructor opens with Consent Mode's default state — everything denied —
 * before the script is fetched, which is the whole point of the sequence: the
 * default has to be in the queue ahead of any hit that could follow it.
 */
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

  /**
   * The script is fetched on the first granted consent, never before: 160 kB of
   * third-party JavaScript on every first visit competes with the LCP for
   * bandwidth, and a visitor who has not answered has nothing to send. Consent
   * Mode's default is already queued, so the tag reads the denied state the
   * moment it arrives.
   */
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
