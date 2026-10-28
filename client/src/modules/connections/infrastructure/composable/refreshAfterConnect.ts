import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'
import { refreshRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import {
  invalidateResource,
  invalidateResourcePrefix,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * After linking a provider mid-session the app already has its shell on screen.
 * Import in place, then invalidate the reads that changed: each one refreshes
 * itself under the reader already showing it, so nothing remounts and no view
 * falls back to its skeleton.
 *
 * `account.current` is refreshed rather than invalidated: the account did not
 * change, only its provider link, and emptying it would blank the header avatar.
 */
export async function refreshAfterConnect(): Promise<void> {
  try {
    await connectionsModule.sync.execute({ announce: false })
  } catch {
    // No activities yet or a transient failure: the views still refresh.
  } finally {
    invalidateResource(RESOURCE_KEYS.planWeek)
    invalidateResource(RESOURCE_KEYS.progress)
    invalidateResource(RESOURCE_KEYS.connectionStatus)
    invalidateResourcePrefix('activities:')
    await refreshRunDay(true)
    try {
      await useCurrentUser().fetchUser(true)
    } catch {
      // A failed profile reread is not worth blocking the refresh.
    }
  }
}
