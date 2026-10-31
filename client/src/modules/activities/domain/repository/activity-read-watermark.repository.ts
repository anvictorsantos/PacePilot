import type { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark'

// Keyed by account: the browser is shared, so two accounts on one machine are two
// different read histories.
export interface ActivityReadWatermarkRepository {
  load(accountId: string): ActivityReadWatermark
  save(accountId: string, watermark: ActivityReadWatermark): void
  /** Erasure: forget one account, leave the others. */
  clear(accountId: string): void
}
