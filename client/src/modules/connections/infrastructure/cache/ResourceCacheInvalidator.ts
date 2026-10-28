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
 *
 * Today is the exception the Resource cache cannot reach: run-day is a module
 * projection guarded by its own `loaded` flag, so an invalidation there is a flag
 * with no reader to serve. The caller injects the re-read, which is why the boot
 * import and the panel's manual sync both complete Today's card without a reload.
 */
export class ResourceCacheInvalidator implements ImportedActivitiesCache {
  constructor(private readonly refreshToday: () => Promise<unknown> = () => Promise.resolve()) {}

  invalidateAfterImport(): void {
    invalidateResource(RESOURCE_KEYS.planWeek)
    invalidateResource(RESOURCE_KEYS.progress)
    invalidateResource(RESOURCE_KEYS.connectionStatus)
    invalidateResourcePrefix('activities:')
    // Its own failure is already reported by the run-day read; an import stays
    // successful even when today's re-read does not answer.
    void this.refreshToday().catch(() => undefined)
  }
}
