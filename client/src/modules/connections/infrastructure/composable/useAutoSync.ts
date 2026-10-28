import { onMounted } from 'vue'

import { autoSyncGate } from '@/modules/connections/infrastructure/composable/auto-sync-gate.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'

/**
 * Import activities on the authenticated app load when the last sync is stale.
 * Mounted once by the shell; a disconnected athlete and a fresh session both
 * return without a request. Failures are already surfaced by the notifier, and
 * a failed auto-sync must never block the first paint.
 *
 * The gate is module scope, not component scope: remounting the shell (route
 * changes with a fresh layout, HMR) must not re-import just because the
 * component mounted. A link or a disconnect re-arms it, so an earlier attempt
 * made against the old connection cannot keep the next one suppressed.
 */
export function useAutoSync(): void {
  const { checkStatus, lastSyncedAt } = useConnection()

  onMounted(async () => {
    try {
      if (!(await checkStatus())) return
      const now = Date.now()
      if (!autoSyncGate.canAttempt(now, lastSyncedAt.value)) return
      autoSyncGate.markAttempt(now)
      await connectionsModule.sync.execute({ announce: false })
    } catch {
      // The notifier toasted; importing is best-effort on load.
    }
  })
}
