/**
 * How the athlete learns what an import did. The application decides *what*
 * happened; the adapter decides how it is said (a toast, today). New,
 * corrected, unchanged, throttled and unconnected are distinct outcomes, so
 * each gets its own intent rather than an empty count standing in for two
 * different silences.
 */
export interface ProviderSyncNotifier {
  imported(count: number): void
  updated(count: number): void
  importedAndUpdated(imported: number, updated: number): void
  upToDate(): void
  throttled(): void
  disconnected(): void
  failed(error: unknown): void
}
