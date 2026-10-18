import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'

/**
 * Port for the athlete's answer: it outlives the visit, so the banner asks once.
 * `null` means they have not been asked yet, which Consent Mode treats the same
 * as a refusal — the default is denied.
 */
export interface AnalyticsConsentRepository {
  read(): AnalyticsConsent | null
  write(consent: AnalyticsConsent): void
}
