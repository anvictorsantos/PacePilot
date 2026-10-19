import type { ImportedActivitiesCache } from '@/modules/strava/domain/repository/imported-activities-cache.repository.ts'
import type {
  StravaSyncRepository,
  SyncOutcome,
} from '@/modules/strava/domain/repository/strava-sync.repository.ts'
import type { StravaSyncNotifier } from '@/modules/strava/domain/service/strava-sync-notifier.ts'

/**
 * Import the athlete's activities and tell them what happened.
 *
 * One operation with two callers — the automatic import on app load and the
 * panel's manual button — so the toast copy, the error classification, the
 * cache invalidation and the in-flight dedupe exist once. Concurrent callers
 * share the running import: a modal click while the app is already importing
 * must not spend a second Strava request.
 */
export class SyncActivities {
  private inFlight: Promise<SyncOutcome> | null = null

  constructor(
    private readonly repository: StravaSyncRepository,
    private readonly cache: ImportedActivitiesCache,
    private readonly notifier: StravaSyncNotifier,
  ) {}

  execute(options: { force?: boolean; announce?: boolean } = {}): Promise<SyncOutcome> {
    if (this.inFlight) return this.inFlight
    const run = this.run(options).finally(() => {
      if (this.inFlight === run) this.inFlight = null
    })
    this.inFlight = run
    return run
  }

  private async run({
    force = false,
    announce = true,
  }: {
    force?: boolean
    announce?: boolean
  }): Promise<SyncOutcome> {
    try {
      const outcome = await this.repository.importActivities({ force })
      // A guarded read is the throttle answering "still fresh" — silent, and
      // nothing changed, so no cache is dropped.
      if (outcome.guarded) return outcome
      if (outcome.imported > 0) {
        this.cache.invalidateAfterImport()
        if (announce) this.notifier.imported(outcome.imported)
      } else if (announce) {
        this.notifier.upToDate()
      }
      return outcome
    } catch (error) {
      // Failures are actionable (reconnect, quota), so they surface even when
      // the import ran silently on app load.
      this.notifier.failed(error)
      throw error
    }
  }
}
