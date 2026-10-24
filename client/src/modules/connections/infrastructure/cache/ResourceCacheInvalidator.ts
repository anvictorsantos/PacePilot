import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import {
  resetResource,
  resetResourcePrefix,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * New activities change the plan, the progress read, the connection's
 * `last_synced_at` and every paged slice of the activities list. Mirrors the
 * feedback subscriber that keeps the Plan and Progress honest after a session.
 */
export class ResourceCacheInvalidator implements ImportedActivitiesCache {
  invalidateAfterImport(): void {
    resetResource(RESOURCE_KEYS.planWeek)
    resetResource(RESOURCE_KEYS.progress)
    resetResource(RESOURCE_KEYS.connectionStatus)
    resetResourcePrefix('activities:')
  }
}
