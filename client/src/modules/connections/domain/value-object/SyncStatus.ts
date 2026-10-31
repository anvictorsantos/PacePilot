/**
 * `Throttled` is the server answering from its own freshness window, `Disconnected`
 * the client refusing before it spends a request; only `Completed` can have written
 * rows, so a caller switches on one value instead of reconciling flags.
 */
export enum SyncStatus {
  Completed = 'completed',
  Throttled = 'throttled',
  Disconnected = 'disconnected',
}
