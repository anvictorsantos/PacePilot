import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import {
  type AnalyticsConsent,
  toAnalyticsConsent,
} from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

/** Mirrors the `pacepilot-locale` key the i18n catalogue stores its choice under. */
const STORAGE_KEY = 'pacepilot-analytics-consent'

// Storage can throw (private mode, quota, a blocked origin), so a failed read means
// "not asked yet" — which asks again rather than assuming yes.
export class LocalStorageAnalyticsConsentRepository implements AnalyticsConsentRepository {
  read(): AnalyticsConsent | null {
    try {
      return toAnalyticsConsent(localStorage.getItem(STORAGE_KEY))
    } catch (error) {
      recordRecoveredError(error, { feature: 'analytics', operation: 'read-consent' })
      return null
    }
  }

  write(consent: AnalyticsConsent): void {
    try {
      localStorage.setItem(STORAGE_KEY, consent)
    } catch (error) {
      recordRecoveredError(error, { feature: 'analytics', operation: 'write-consent' })
    }
  }
}
