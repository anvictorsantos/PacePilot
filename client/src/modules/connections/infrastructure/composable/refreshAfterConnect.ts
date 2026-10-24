import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'
import { refreshRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { triggerAppRefresh } from '@/modules/shared/infrastructure/app-refresh.ts'
import {
  resetResource,
  resetResourcePrefix,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * After linking a provider mid-session the app already has its shell on screen.
 * Import in place, drop the reads that changed, then remount the visible view so
 * it re-reads without a page reload the athlete would notice.
 *
 * `account.current` is kept: the account did not change, only its provider link,
 * and clearing it would blank the header avatar until the next page load.
 */
export async function refreshAfterConnect(): Promise<void> {
  try {
    await connectionsModule.sync.execute({ announce: false })
  } catch {
    // No activities yet or a transient failure: the views still re-read.
  } finally {
    resetResource(RESOURCE_KEYS.planWeek)
    resetResource(RESOURCE_KEYS.progress)
    resetResource(RESOURCE_KEYS.connectionStatus)
    resetResourcePrefix('activities:')
    await refreshRunDay(true)
    try {
      await useCurrentUser().fetchUser(true)
    } catch {
      // A failed profile reread is not worth blocking the refresh.
    }
    triggerAppRefresh()
  }
}
