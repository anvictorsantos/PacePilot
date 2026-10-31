// The application decides what happened; the adapter decides how it is said. Each
// outcome is distinct, so no empty count stands in for two different silences.
export interface ProviderSyncNotifier {
  imported(count: number): void
  updated(count: number): void
  importedAndUpdated(imported: number, updated: number): void
  upToDate(): void
  throttled(): void
  disconnected(): void
  failed(error: unknown): void
}
