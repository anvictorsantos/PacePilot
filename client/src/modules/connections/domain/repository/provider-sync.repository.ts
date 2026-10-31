import type { SyncStatus } from '@/modules/connections/domain/value-object/SyncStatus.ts'

/** What one import run did, in domain terms — not the wire shape. */
export interface SyncOutcome {
  imported: number
  // Fetched activities that already existed and were rewritten in place: the
  // provider is the source of truth, so an upstream correction lands here.
  updated: number
  status: SyncStatus
}

/** Port: import the athlete's Strava activities into the read model. */
export interface ProviderSyncRepository {
  importActivities(options?: { force?: boolean }): Promise<SyncOutcome>
}
