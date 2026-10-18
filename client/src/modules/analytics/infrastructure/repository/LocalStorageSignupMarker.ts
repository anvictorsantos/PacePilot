import type { SignupMarker } from '@/modules/analytics/domain/repository/signup-marker.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

const STORAGE_KEY = 'pacepilot-analytics-signup-sent'

/**
 * One flag on this browser. A storage failure reads as "already sent", which
 * costs a duplicate count at worst and never invents one.
 */
export class LocalStorageSignupMarker implements SignupMarker {
  sent(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch (error) {
      recordRecoveredError(error, { feature: 'analytics', operation: 'read-signup-marker' })
      return true
    }
  }

  remember(): void {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch (error) {
      recordRecoveredError(error, { feature: 'analytics', operation: 'write-signup-marker' })
    }
  }
}
