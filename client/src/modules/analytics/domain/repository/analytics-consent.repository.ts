import type { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'

/** Persists the athlete's answer; `null` means not asked yet, which Consent Mode treats as denied. */
export interface AnalyticsConsentRepository {
  read(): AnalyticsConsent | null
  write(consent: AnalyticsConsent): void
}
