import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import type {
  ProviderSyncRepository,
  SyncOutcome,
} from '@/modules/connections/domain/repository/provider-sync.repository.ts'
import type { ProviderSyncNotifier } from '@/modules/connections/domain/service/provider-sync-notifier.ts'
import { SyncStatus } from '@/modules/connections/domain/value-object/SyncStatus.ts'

// Two callers, one dedupe and one set of toasts. A manual call never folds into
// an automatic run, which the server may answer from freshness as "nothing new".
export class SyncActivities {
  private automatic: Promise<SyncOutcome> | null = null
  private forced: Promise<SyncOutcome> | null = null

  constructor(
    private readonly repository: ProviderSyncRepository,
    private readonly cache: ImportedActivitiesCache,
    private readonly notifier: ProviderSyncNotifier,
  ) {}

  execute(options: { force?: boolean; announce?: boolean } = {}): Promise<SyncOutcome> {
    if (options.force) {
      if (!this.forced) this.forced = this.track('forced', this.run(options))
      return this.forced
    }
    // An automatic call rides whatever is already running, forced or not.
    const running = this.forced ?? this.automatic
    if (running) return running
    this.automatic = this.track('automatic', this.run(options))
    return this.automatic
  }

  private track(slot: 'automatic' | 'forced', run: Promise<SyncOutcome>): Promise<SyncOutcome> {
    const tracked = run.finally(() => {
      if (this[slot] === tracked) this[slot] = null
    })
    this[slot] = tracked
    return tracked
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
      // Throttled and disconnected wrote no row: say which, never "nothing new",
      // which would claim the provider was asked.
      if (outcome.status === SyncStatus.Throttled) {
        if (announce) this.notifier.throttled()
        return outcome
      }
      if (outcome.status === SyncStatus.Disconnected) {
        if (announce) this.notifier.disconnected()
        return outcome
      }

      // New and corrected rows are both written, so any fetched row makes reads stale.
      if (outcome.imported + outcome.updated > 0) this.cache.invalidateAfterImport()
      if (announce) this.announce(outcome)
      return outcome
    } catch (error) {
      // Failures are actionable (reconnect, quota), so they surface even on a
      // silent app-load import.
      this.notifier.failed(error)
      throw error
    }
  }

  private announce(outcome: SyncOutcome): void {
    const { imported, updated } = outcome
    if (imported > 0 && updated > 0) this.notifier.importedAndUpdated(imported, updated)
    else if (imported > 0) this.notifier.imported(imported)
    else if (updated > 0) this.notifier.updated(updated)
    else this.notifier.upToDate()
  }
}
