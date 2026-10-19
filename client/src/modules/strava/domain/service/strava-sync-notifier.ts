/**
 * How the athlete learns what an import did. The application decides *what*
 * happened; the adapter decides how it is said (a toast, today).
 */
export interface StravaSyncNotifier {
  imported(count: number): void
  upToDate(): void
  failed(error: unknown): void
}
