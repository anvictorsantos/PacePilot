import type { ActivityReadWatermarkRepository } from '@/modules/activities/domain/repository/activity-read-watermark.repository.ts'
import { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

// One localStorage entry per account. A storage failure behaves as "never looked", re-lighting
// the feed; an empty account id is refused because a shared key is the cross-account leak this key prevents.
export class LocalStorageActivityReadWatermarkRepository implements ActivityReadWatermarkRepository {
  static readonly PREFIX = 'activity-read:'

  static keyFor(accountId: string): string {
    return `${LocalStorageActivityReadWatermarkRepository.PREFIX}${accountId}`
  }

  load(accountId: string): ActivityReadWatermark {
    if (!accountId) return ActivityReadWatermark.never()
    try {
      return ActivityReadWatermark.fromPrimitives(
        localStorage.getItem(LocalStorageActivityReadWatermarkRepository.keyFor(accountId)),
      )
    } catch (error) {
      recordRecoveredError(error, { feature: 'activities', operation: 'read-watermark' })
      return ActivityReadWatermark.never()
    }
  }

  save(accountId: string, watermark: ActivityReadWatermark): void {
    if (!accountId) return
    try {
      const value = watermark.toPrimitives()
      const key = LocalStorageActivityReadWatermarkRepository.keyFor(accountId)
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch (error) {
      recordRecoveredError(error, { feature: 'activities', operation: 'write-watermark' })
    }
  }

  clear(accountId: string): void {
    if (!accountId) return
    try {
      localStorage.removeItem(LocalStorageActivityReadWatermarkRepository.keyFor(accountId))
    } catch (error) {
      recordRecoveredError(error, { feature: 'activities', operation: 'clear-watermark' })
    }
  }
}
