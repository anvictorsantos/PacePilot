/** `POST /api/strava/sync` — what the import did. */
export interface SyncResult {
  last_synced_at?: string | null
  imported?: number | null
}
