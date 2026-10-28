import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import { refreshConnectionStatus } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import {
  resetResource,
  resetResourcePrefix,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * New activities change the plan, the progress read, the connection's
 * `last_synced_at` and every paged slice of the activities list. Mirrors the
 * feedback subscriber that keeps the Plan and Progress honest after a session.
 *
 * The connection is re-read rather than dropped: deleting the key would blank
 * the status the header is rendering and flash "not connected" after a sync.
 */
export class ResourceCacheInvalidator implements ImportedActivitiesCache {
  invalidateAfterImport(): void {
    resetResource(RESOURCE_KEYS.planWeek)
    resetResource(RESOURCE_KEYS.progress)
    resetResourcePrefix('activities:')
    void refreshConnectionStatus()
  }
}
