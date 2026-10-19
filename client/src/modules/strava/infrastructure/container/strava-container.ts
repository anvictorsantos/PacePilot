import { container } from '@/modules/shared/infrastructure/container.ts'
import type { ContainerToken } from '@/modules/shared/infrastructure/container.ts'
import { SyncActivities } from '@/modules/strava/application/use-case/SyncActivities.ts'
import type { ImportedActivitiesCache } from '@/modules/strava/domain/repository/imported-activities-cache.repository.ts'
import type { StravaSyncRepository } from '@/modules/strava/domain/repository/strava-sync.repository.ts'
import type { StravaSyncNotifier } from '@/modules/strava/domain/service/strava-sync-notifier.ts'
import { ResourceCacheInvalidator } from '@/modules/strava/infrastructure/cache/ResourceCacheInvalidator.ts'
import { ToastStravaSyncNotifier } from '@/modules/strava/infrastructure/notification/ToastStravaSyncNotifier.ts'
import { StravaSyncApiRepository } from '@/modules/strava/infrastructure/repository/StravaSyncApiRepository.ts'

/**
 * Wiring for the strava module. One import operation, two callers (auto-sync on
 * app load, the panel's manual button), so the ports are bound once here.
 */
const SYNC_REPOSITORY: ContainerToken = 'StravaSyncRepository'
const SYNC_NOTIFIER: ContainerToken = 'StravaSyncNotifier'
const IMPORTED_CACHE: ContainerToken = 'ImportedActivitiesCache'

container.bindSingleton(SYNC_REPOSITORY, () => new StravaSyncApiRepository())
container.bindSingleton(SYNC_NOTIFIER, () => new ToastStravaSyncNotifier())
container.bindSingleton(IMPORTED_CACHE, () => new ResourceCacheInvalidator())
container.bindSingleton(
  SyncActivities,
  (c) =>
    new SyncActivities(
      c.get<StravaSyncRepository>(SYNC_REPOSITORY),
      c.get<ImportedActivitiesCache>(IMPORTED_CACHE),
      c.get<StravaSyncNotifier>(SYNC_NOTIFIER),
    ),
)

export const stravaModule = {
  sync: container.get<SyncActivities>(SyncActivities),
}
