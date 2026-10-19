import { api } from '@/modules/shared/infrastructure/http/client.ts'
import type {
  StravaSyncRepository,
  SyncOutcome,
} from '@/modules/strava/domain/repository/strava-sync.repository.ts'

/** Translates the wire result into domain terms; no component sees the DTO. */
export class StravaSyncApiRepository implements StravaSyncRepository {
  async importActivities({ force = false }: { force?: boolean } = {}): Promise<SyncOutcome> {
    const data = await api.strava.sync(force)
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
