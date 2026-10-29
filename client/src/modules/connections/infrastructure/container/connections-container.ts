import { BackfillHistory } from '@/modules/connections/application/use-case/BackfillHistory.ts'
import { SyncActivities } from '@/modules/connections/application/use-case/SyncActivities.ts'
import type { BackfillRepository } from '@/modules/connections/domain/repository/backfill.repository.ts'
import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import type { ProviderSyncRepository } from '@/modules/connections/domain/repository/provider-sync.repository.ts'
import type { ProviderSyncNotifier } from '@/modules/connections/domain/service/provider-sync-notifier.ts'
import { ResourceCacheInvalidator } from '@/modules/connections/infrastructure/cache/ResourceCacheInvalidator.ts'
import { ToastProviderSyncNotifier } from '@/modules/connections/infrastructure/notification/ToastProviderSyncNotifier.ts'
import { BackfillApiRepository } from '@/modules/connections/infrastructure/repository/BackfillApiRepository.ts'
import { ProviderSyncApiRepository } from '@/modules/connections/infrastructure/repository/ProviderSyncApiRepository.ts'
import { refreshRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import type { ContainerToken } from '@/modules/shared/infrastructure/container.ts'
import { container } from '@/modules/shared/infrastructure/container.ts'

/**
 * Wiring for the connections module. One import operation, two callers (auto-sync on
 * app load, the panel's manual button), so the ports are bound once here. The
 * historical import rides the same cache invalidator for the same reason.
 */
const SYNC_REPOSITORY: ContainerToken = 'ProviderSyncRepository'
const SYNC_NOTIFIER: ContainerToken = 'ProviderSyncNotifier'
const IMPORTED_CACHE: ContainerToken = 'ImportedActivitiesCache'
const BACKFILL_REPOSITORY: ContainerToken = 'BackfillRepository'

container.bindSingleton(SYNC_REPOSITORY, () => new ProviderSyncApiRepository())
container.bindSingleton(SYNC_NOTIFIER, () => new ToastProviderSyncNotifier())
// Today's session is re-read on every import, forced: it is not a Resource, and
// the read that mounted before the import must not decide the card for the rest
// of the session.
container.bindSingleton(
  IMPORTED_CACHE,
  () => new ResourceCacheInvalidator(() => refreshRunDay(true)),
)
container.bindSingleton(BACKFILL_REPOSITORY, () => new BackfillApiRepository())
container.bindSingleton(
  SyncActivities,
  (c) =>
    new SyncActivities(
      c.get<ProviderSyncRepository>(SYNC_REPOSITORY),
      c.get<ImportedActivitiesCache>(IMPORTED_CACHE),
      c.get<ProviderSyncNotifier>(SYNC_NOTIFIER),
    ),
)
container.bindSingleton(
  BackfillHistory,
  (c) =>
    new BackfillHistory(
      c.get<BackfillRepository>(BACKFILL_REPOSITORY),
      c.get<ImportedActivitiesCache>(IMPORTED_CACHE),
    ),
)

export const connectionsModule = {
  sync: container.get<SyncActivities>(SyncActivities),
  backfill: container.get<BackfillHistory>(BackfillHistory),
}
