import { onMounted } from 'vue'

import { autoSyncGate } from '@/modules/connections/infrastructure/composable/auto-sync-gate.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'

// Import on authenticated app load when the last sync is stale. The gate is
// module scope, so a shell remount (route change, HMR) cannot re-import; a link
// or a disconnect re-arms it.
export function useAutoSync(): void {
  const { checkStatus, lastSyncedAt } = useConnection()

  onMounted(async () => {
    try {
      if (!(await checkStatus())) return
      const now = Date.now()
      if (autoSyncGate.canAttempt(now, lastSyncedAt.value)) {
        autoSyncGate.markAttempt(now)
        await connectionsModule.sync.execute({ announce: false })
      }
      // Never awaited: a walk queued by a mid-session connect resumes from its
      // cursor on next load if this one closes, and plans render meanwhile.
      void connectionsModule.backfill.run().catch(() => undefined)
    } catch {
      // The notifier toasted; importing is best-effort on load.
    }
  })
}
