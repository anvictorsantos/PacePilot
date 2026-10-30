import type { ImportedActivitiesCache } from '@/modules/connections/domain/repository/imported-activities-cache.repository.ts'
import type {
  ProviderSyncRepository,
  SyncOutcome,
} from '@/modules/connections/domain/repository/provider-sync.repository.ts'
import type { ProviderSyncNotifier } from '@/modules/connections/domain/service/provider-sync-notifier.ts'
import { SyncStatus } from '@/modules/connections/domain/value-object/SyncStatus.ts'

/**
 * Import the athlete's activities and tell them what happened.
 *
 * One operation with two callers — the automatic import on app load and the
 * panel's manual button — so the toast copy, the error classification, the
 * cache invalidation and the in-flight dedupe exist once.
 *
 * Automatic callers share the running import: a second silent import would
 * only spend a provider request for the same answer. A manual caller does not
 * fold into an automatic run, because the server may answer that run from its
 * freshness window — so the click would report "nothing new" without ever
 * calling the provider. It gets its own forced request instead; two clicks
 * still share one.
 */
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
    // An automatic call rides whatever is already running, forced or not: the
    // run in flight is a real import either way.
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
      // Neither case wrote a row: the throttle answered from its freshness
      // window, or there is no link to import from. Say which, never "nothing
      // new" — that would claim the provider was asked.
      if (outcome.status === SyncStatus.Throttled) {
        if (announce) this.notifier.throttled()
        return outcome
      }
      if (outcome.status === SyncStatus.Disconnected) {
        if (announce) this.notifier.disconnected()
        return outcome
      }

      // Every fetched row is written, whether it was new or a correction of a
      // row the athlete already had, so any fetched row makes the reads stale.
      if (outcome.imported + outcome.updated > 0) this.cache.invalidateAfterImport()
      if (announce) this.announce(outcome)
      return outcome
    } catch (error) {
      // Failures are actionable (reconnect, quota), so they surface even when
      // the import ran silently on app load.
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
