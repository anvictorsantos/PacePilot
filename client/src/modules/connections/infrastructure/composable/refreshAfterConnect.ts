import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { refreshConnectionStatus } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'
import { refreshRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import {
  invalidateResource,
  invalidateResourcePrefix,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * The OAuth consent window has closed, the link exists, and the destination view
 * has not mounted yet.
 *
 * Two things are guaranteed before this resolves, and only two. The import runs
 * first, because it is the one step every visible read depends on; its failure is
 * swallowed here (the toast surface already owns it) so the rest still refreshes.
 * Then today's session is re-read: run-day is a module-level projection, not a
 * Resource, so this await is what puts the imported run on the card the
 * destination is about to paint.
 *
 * The cached reads are marked stale and not waited for. `invalidateResource`
 * resolves straight away when no reader is registered, and the destination reads
 * Today, the plan and progress with direct API calls rather than through the
 * Resource module — so awaiting those calls promised a refresh the schedule never
 * performed. The mark is the contract that matters: whoever reads the key next
 * fetches instead of serving the value from before the connect.
 *
 * The status and profile reads only confirm what is already on screen, so they are
 * not waited for either; each reports its own failure.
 */
export async function refreshAfterConnect(): Promise<void> {
  try {
    await connectionsModule.sync.execute({ announce: false })
  } catch {
    // No activities yet or a transient failure: every read below still refreshes.
  }

  // Derived reads change with the import; the next reader must not be served the
  // pre-connect answer.
  void invalidateResource(RESOURCE_KEYS.planWeek)
  void invalidateResource(RESOURCE_KEYS.progress)
  void invalidateResourcePrefix('activities:')

  // Today is not cached, and it is already on screen when the link comes from
  // Settings: this read is what completes the card with the run just imported.
  await refreshRunDay(true)

  void confirmConnectionAndProfile()
}

async function confirmConnectionAndProfile(): Promise<void> {
  await Promise.allSettled([refreshConnectionStatus(), useCurrentUser().fetchUser(true)])
}
