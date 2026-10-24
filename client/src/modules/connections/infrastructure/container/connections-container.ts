import { SyncActivities } from '@/modules/connections/application/use-case/SyncActivities.ts'
import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import type { ProviderSyncRepository } from '@/modules/connections/domain/repository/provider-sync.repository.ts'
import type { ProviderSyncNotifier } from '@/modules/connections/domain/service/provider-sync-notifier.ts'
import { ResourceCacheInvalidator } from '@/modules/connections/infrastructure/cache/ResourceCacheInvalidator.ts'
import { ToastProviderSyncNotifier } from '@/modules/connections/infrastructure/notification/ToastProviderSyncNotifier.ts'
import { ProviderSyncApiRepository } from '@/modules/connections/infrastructure/repository/ProviderSyncApiRepository.ts'
import type { ContainerToken } from '@/modules/shared/infrastructure/container.ts'
import { container } from '@/modules/shared/infrastructure/container.ts'

/**
 * Wiring for the connections module. One import operation, two callers (auto-sync on
 * app load, the panel's manual button), so the ports are bound once here.
 */
const SYNC_REPOSITORY: ContainerToken = 'ProviderSyncRepository'
const SYNC_NOTIFIER: ContainerToken = 'ProviderSyncNotifier'
const IMPORTED_CACHE: ContainerToken = 'ImportedActivitiesCache'

container.bindSingleton(SYNC_REPOSITORY, () => new ProviderSyncApiRepository())
container.bindSingleton(SYNC_NOTIFIER, () => new ToastProviderSyncNotifier())
container.bindSingleton(IMPORTED_CACHE, () => new ResourceCacheInvalidator())
container.bindSingleton(
  SyncActivities,
  (c) =>
    new SyncActivities(
      c.get<ProviderSyncRepository>(SYNC_REPOSITORY),
      c.get<ImportedActivitiesCache>(IMPORTED_CACHE),
      c.get<ProviderSyncNotifier>(SYNC_NOTIFIER),
    ),
)

export const connectionsModule = {
  sync: container.get<SyncActivities>(SyncActivities),
}
