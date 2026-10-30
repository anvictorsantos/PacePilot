import type { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark'

/**
 * Port: where one account's "last looked at the feed" instant lives.
 *
 * Keyed by account because the browser is shared: two accounts signing in on
 * the same machine are two different read histories.
 */
export interface ActivityReadWatermarkRepository {
  load(accountId: string): ActivityReadWatermark
  save(accountId: string, watermark: ActivityReadWatermark): void
  /** Erasure: forget one account's watermark, leave the others alone. */
  clear(accountId: string): void
}
