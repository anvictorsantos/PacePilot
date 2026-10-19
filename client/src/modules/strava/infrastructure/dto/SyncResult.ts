/** `POST /api/strava/sync` — what the import did. */
export interface SyncResult {
  imported?: number | null
  skipped?: number | null
  totalFetched?: number | null
  total?: number | null
  truncated?: boolean | null
  /** The server's throttle answered without calling Strava. */
  guarded?: boolean | null
  last_synced_at?: string | null
}
