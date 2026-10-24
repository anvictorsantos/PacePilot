/** `GET /api/providers/status` — connection state, safe to read when signed out. */
export interface ConnectionEntry {
  provider: string
  connected: boolean
  last_synced_at: string | null
}

export interface ConnectionStatus {
  connected?: boolean
  /** The active evidence source, when one is connected. */
  provider?: string | null
  last_synced_at?: string | null
  connections?: ConnectionEntry[]
}
