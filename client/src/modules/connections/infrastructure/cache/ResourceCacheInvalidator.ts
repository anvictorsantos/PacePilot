import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import {
  invalidateResource,
  invalidateResourcePrefix,
} from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

// Invalidate, not clear: a read may be on screen and a clear would blank it. Today
// lives outside this cache, so the caller injects its re-read.
export class ResourceCacheInvalidator implements ImportedActivitiesCache {
  constructor(private readonly refreshToday: () => Promise<unknown> = () => Promise.resolve()) {}

  invalidateAfterImport(): void {
    invalidateResource(RESOURCE_KEYS.planWeek)
    invalidateResource(RESOURCE_KEYS.progress)
    invalidateResource(RESOURCE_KEYS.connectionStatus)
    invalidateResourcePrefix('activities:')
    // Its own failure is already reported by the run-day read.
    void this.refreshToday().catch(() => undefined)
  }
}
