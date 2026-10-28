import type { SyncStatus } from '@/modules/connections/domain/value-object/SyncStatus.ts'

/** What one import run did, in domain terms — not the wire shape. */
export interface SyncOutcome {
  /** Activities the athlete did not have before. */
  imported: number
  /**
   * Fetched activities that already existed and were rewritten in place. The
   * provider is the source of truth, so an upstream correction lands here:
   * the athlete's copy changed even though no id appeared.
   */
  updated: number
  totalFetched: number
  truncated: boolean
  status: SyncStatus
  lastSyncedAt: string | null
}

/** Port: import the athlete's Strava activities into the read model. */
export interface ProviderSyncRepository {
  importActivities(options?: { force?: boolean }): Promise<SyncOutcome>
}
