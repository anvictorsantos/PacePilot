import type {
  BackfillProgress,
  BackfillRepository,
} from '@/modules/connections/domain/repository/backfill.repository.ts'
import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import {
  isBackfillComplete,
  isBackfillRunning,
} from '@/modules/connections/domain/value-object/BackfillStatus.ts'

/**
 * Safety net over the server's own page budget: each request is already bounded,
 * so the client only needs a ceiling against a provider that never reports the
 * end of history. 20 rounds × 3 pages × 50 rows leaves room for the whole
 * retained window without ever becoming an unbounded loop.
 */
export const BACKFILL_MAX_ROUNDS = 20

/**
 * Request older history the first import capped off.
 *
 * The cursor lives on the server, so this class is a driver, not a state
 * machine: it asks for one bounded step at a time and stops the moment the
 * server says the window is covered, a manual sync has taken the provider, or
 * the athlete pressed stop. Re-running is safe — that is what makes stop,
 * reload and resume the same operation.
 */
export class BackfillHistory {
  private inFlight: Promise<BackfillProgress> | null = null
  private stopped = false

  constructor(
    private readonly repository: BackfillRepository,
    private readonly cache: ImportedActivitiesCache,
  ) {}

  status(): Promise<BackfillProgress> {
    return this.repository.status()
  }

  /** Start or resume. Concurrent callers share the running walk. */
  run(): Promise<BackfillProgress> {
    if (this.inFlight) return this.inFlight
    this.stopped = false
    const run = this.walk().finally(() => {
      if (this.inFlight === run) this.inFlight = null
    })
    this.inFlight = run
    return run
  }

  /**
   * Stop between steps. The in-flight request is allowed to finish — the server
   * bounds it — and its cursor is the resume point.
   */
  async stop(): Promise<BackfillProgress> {
    this.stopped = true
    return this.repository.stop()
  }

  private async walk(): Promise<BackfillProgress> {
    let progress = await this.repository.status()
    let wrote = progress.imported > 0
    try {
      for (let round = 0; round < BACKFILL_MAX_ROUNDS; round++) {
        if (this.stopped || !progress.hasMore) break
        progress = await this.repository.step()
        wrote = wrote || progress.imported > 0
        // Covered, stopped, failed — or another caller holds the cursor. None of
        // those want a second request from this client.
        if (
          !progress.hasMore ||
          isBackfillComplete(progress.status) ||
          isBackfillRunning(progress.status)
        ) {
          break
        }
      }
    } finally {
      // One invalidation for the whole walk: Today and the progress windows
      // re-read after it, never once per page.
      if (wrote) this.cache.invalidateAfterImport()
    }
    return progress
  }
}
