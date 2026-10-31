import type {
  ProviderSyncRepository,
  SyncOutcome,
} from '@/modules/connections/domain/repository/provider-sync.repository.ts'
import { SyncStatus } from '@/modules/connections/domain/value-object/SyncStatus.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

const NOT_CONNECTED: SyncOutcome = {
  imported: 0,
  updated: 0,
  status: SyncStatus.Disconnected,
}

export class ProviderSyncApiRepository implements ProviderSyncRepository {
  async importActivities({ force = false }: { force?: boolean } = {}): Promise<SyncOutcome> {
    // The active source is server truth: a disconnected account resolves to a
    // no-op before the sync request instead of spending one on a provider.
    const status = await api.providers.status()
    const provider = status.provider
    if (!provider) return NOT_CONNECTED

    const data = await api.providers.sync(provider, force)
    return {
      imported: data.imported ?? 0,
      // The server counts fetched rows that already existed as `skipped`; the
      // upsert rewrites every one of them, so in domain terms they were updated.
      updated: data.skipped ?? 0,
      status: data.guarded ? SyncStatus.Throttled : SyncStatus.Completed,
    }
  }
}
