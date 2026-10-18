/** `GET /api/strava/status` — connection state, safe to read when signed out. */
export interface StravaStatus {
  connected?: boolean
  last_synced_at?: string | null
}
