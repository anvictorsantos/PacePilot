/** Sync at most this often on app load; the server enforces the same window. */
export const AUTO_SYNC_STALE_MS = 15 * 60 * 1000

// The in-session half of the throttle; `rearm` on the connection write so an
// attempt against the previous link does not suppress the next import.
export class AutoSyncGate {
  private attemptedAt = 0

  constructor(private readonly staleMs = AUTO_SYNC_STALE_MS) {}

  canAttempt(now: number, lastSyncedAt: string | null): boolean {
    if (this.attemptedAt && now - this.attemptedAt < this.staleMs) return false
    if (!lastSyncedAt) return true
    const last = new Date(lastSyncedAt).getTime()
    // An unreadable watermark is no evidence of freshness: import.
    if (Number.isNaN(last)) return true
    return now - last >= this.staleMs
  }

  markAttempt(now: number): void {
    this.attemptedAt = now
  }

  rearm(): void {
    this.attemptedAt = 0
  }
}

export const autoSyncGate = new AutoSyncGate()
