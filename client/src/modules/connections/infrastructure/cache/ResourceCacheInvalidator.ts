import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import {
  invalidateResource,
  invalidateResourcePrefix,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * New activities change the plan, the progress read, the connection's
 * `last_synced_at` and every paged slice of the activities list. Mirrors the
 * feedback subscriber that keeps the Plan and Progress honest after a session.
 *
 * These are invalidations, not clears: the import can land while one of those
 * reads is on screen, and deleting the entry underneath it would blank the view
 * until it remounted. The connection is included: it is refreshed in place too,
 * so the header never flashes "not connected" after a sync. A key nobody is
 * reading is only marked stale and re-read by its next reader.
 */
export class ResourceCacheInvalidator implements ImportedActivitiesCache {
  invalidateAfterImport(): void {
    invalidateResource(RESOURCE_KEYS.planWeek)
    invalidateResource(RESOURCE_KEYS.progress)
    invalidateResource(RESOURCE_KEYS.connectionStatus)
    invalidateResourcePrefix('activities:')
  }
}
