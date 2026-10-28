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
 * has not mounted yet. Import first, then refresh every read that view will show,
 * and resolve only once those reads hold the imported data: the caller enters the
 * app on the next line, so a read started before the import had landed would
 * paint the empty state the athlete had to reload away from.
 *
 * Order is the guarantee. The import is the one step every visible read depends
 * on, so it comes first; the visible reads follow together, each isolated from
 * the others; the reads that only confirm what is already on screen come last and
 * are not waited for, so a slow or failing status/profile read cannot hold the
 * destination back. Nothing here rejects — the failure is already on the toast
 * surface, and the screens still have to refresh.
 */
export async function refreshAfterConnect(): Promise<void> {
  try {
    await connectionsModule.sync.execute({ announce: false })
  } catch {
    // No activities yet or a transient failure: every read below still refreshes.
  }

  // The visible reads. `allSettled` so one failing read cannot starve the rest,
  // and awaited so the destination's first paint is the refreshed one.
  await Promise.allSettled([
    invalidateResource(RESOURCE_KEYS.planWeek),
    invalidateResource(RESOURCE_KEYS.progress),
    invalidateResourcePrefix('activities:'),
    // Today's session is part of the destination's first paint.
    refreshRunDay(true),
  ])

  // Confirmation only, so the destination is not held behind it. Each read
  // reports its own failure, and `allSettled` keeps one from cancelling the other.
  void confirmConnectionAndProfile()
}

async function confirmConnectionAndProfile(): Promise<void> {
  await Promise.allSettled([refreshConnectionStatus(), useCurrentUser().fetchUser(true)])
}
