/** What one import run did, in domain terms — not the wire shape. */
export interface SyncOutcome {
  imported: number
  skipped: number
  totalFetched: number
  total: number
  truncated: boolean
  lastSyncedAt: string | null
  /** The server answered from its own throttle window, without calling Strava. */
  guarded: boolean
}

/** Port: import the athlete's Strava activities into the read model. */
export interface ProviderSyncRepository {
  importActivities(options?: { force?: boolean }): Promise<SyncOutcome>
}
