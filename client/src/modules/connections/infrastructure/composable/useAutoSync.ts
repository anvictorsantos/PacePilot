import { onMounted } from 'vue'

import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'

/** Sync at most this often on app load; the server enforces the same window. */
export const AUTO_SYNC_STALE_MS = 15 * 60 * 1000

// Module scope, not component scope: remounting the shell (route changes with a
// fresh layout, HMR) must not re-import just because the component mounted.
let attemptedAt = 0

/**
 * Import activities on the authenticated app load when the last sync is stale.
 * Mounted once by the shell; a disconnected athlete and a fresh session both
 * return without a request. Failures are already surfaced by the notifier, and
 * a failed auto-sync must never block the first paint.
 *
 * A connection created mid-session queues a historical walk; it is started here
 * without being awaited, so Today and the plan render from what is stored while
 * the walk runs (the server bounds every step).
 */
export function useAutoSync(): void {
  const { checkStatus, lastSyncedAt } = useConnection()

  async function syncWhenStale(): Promise<void> {
    if (Date.now() - attemptedAt < AUTO_SYNC_STALE_MS) return
    const last = lastSyncedAt.value
    if (last && Date.now() - new Date(last).getTime() < AUTO_SYNC_STALE_MS) return
    attemptedAt = Date.now()
    await connectionsModule.sync.execute({ announce: false })
  }

  onMounted(async () => {
    try {
      if (!(await checkStatus())) return
      await syncWhenStale()
      // Never awaited: a walk queued by a mid-session connect resumes from its
      // cursor on the next load if this one is closed, and plans render meanwhile.
      void connectionsModule.backfill.run().catch(() => undefined)
    } catch {
      // The notifier toasted; importing is best-effort on load.
    }
  })
}
