/** Sync at most this often on app load; the server enforces the same window. */
export const AUTO_SYNC_STALE_MS = 15 * 60 * 1000

/**
 * The in-session half of the auto-sync throttle. The server already refuses an
 * import inside its freshness window; this keeps a remount, a route change or a
 * second tab from asking at all. One instance lives at module scope, so the
 * shell remounting does not re-import.
 *
 * `rearm` is the connection write: an attempt made against the previous link —
 * a failed first import, a disconnect, a different account — says nothing about
 * the connection that exists now, so it must not keep the next import
 * suppressed. The server's watermark is untouched; it is still the truth.
 */
export class AutoSyncGate {
  private attemptedAt = 0

  constructor(private readonly staleMs = AUTO_SYNC_STALE_MS) {}

  /** Is a real import worth asking for? */
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

/** The shell's gate; tests construct their own with a fixed clock. */
export const autoSyncGate = new AutoSyncGate()
