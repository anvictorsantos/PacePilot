import type {
  BackfillProgress,
  BackfillRepository,
} from '@/modules/connections/domain/repository/backfill.repository.ts'
import {
  BackfillStatus,
  toBackfillStatus,
} from '@/modules/connections/domain/value-object/BackfillStatus.ts'
import type { BackfillProgressDto } from '@/modules/connections/infrastructure/dto/BackfillProgress.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

/** Nothing queued: a signed-out or disconnected athlete walks no history. */
const IDLE: BackfillProgress = {
  status: BackfillStatus.Idle,
  imported: 0,
  skipped: 0,
  pagesDone: 0,
  hasMore: false,
  error: null,
}

function toProgress(dto: BackfillProgressDto): BackfillProgress {
  return {
    status: toBackfillStatus(dto.status),
    imported: dto.imported ?? 0,
    skipped: dto.skipped ?? 0,
    pagesDone: dto.pagesDone ?? 0,
    hasMore: Boolean(dto.hasMore),
    error: dto.error?.code
      ? { code: dto.error.code, retryAfter: dto.error.retryAfter ?? null }
      : null,
  }
}

// The active source is server truth, read per call: a disconnect or reconnect
// between walk rounds must not point at a stale source.
export class BackfillApiRepository implements BackfillRepository {
  async status(): Promise<BackfillProgress> {
    const provider = await this.providerId()
    if (!provider) return IDLE
    return toProgress(await api.providers.backfillStatus(provider))
  }

  async step(): Promise<BackfillProgress> {
    const provider = await this.providerId()
    if (!provider) return IDLE
    return toProgress(await api.providers.backfillStep(provider))
  }

  async stop(): Promise<BackfillProgress> {
    const provider = await this.providerId()
    if (!provider) return IDLE
    return toProgress(await api.providers.backfillStop(provider))
  }

  private async providerId(): Promise<string | null> {
    const status = await api.providers.status()
    return status.provider ?? null
  }
}
