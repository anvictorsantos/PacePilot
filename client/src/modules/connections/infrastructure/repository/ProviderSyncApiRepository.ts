import type {
  ProviderSyncRepository,
  SyncOutcome,
} from '@/modules/connections/domain/repository/provider-sync.repository.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

const EMPTY: SyncOutcome = {
  imported: 0,
  skipped: 0,
  totalFetched: 0,
  total: 0,
  truncated: false,
  lastSyncedAt: null,
  guarded: true,
}

/** Translates the wire result into domain terms; no component sees the DTO. */
export class ProviderSyncApiRepository implements ProviderSyncRepository {
  async importActivities({ force = false }: { force?: boolean } = {}): Promise<SyncOutcome> {
    // The active source is server truth. A disconnected account resolves to a
    // guarded no-op instead of spending a request on a provider it does not hold.
    const status = await api.providers.status()
    const provider = status.provider
    if (!provider) return EMPTY

    const data = await api.providers.sync(provider, force)
    return {
      imported: data.imported ?? 0,
      skipped: data.skipped ?? 0,
      totalFetched: data.totalFetched ?? 0,
      total: data.total ?? 0,
      truncated: Boolean(data.truncated),
      lastSyncedAt: data.last_synced_at ?? null,
      guarded: Boolean(data.guarded),
    }
  }
}
