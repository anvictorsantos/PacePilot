/**
 * How one import run ended. `Throttled` is the server answering from its own
 * freshness window without calling the provider; `Disconnected` is the client
 * refusing before it spends a request. Only `Completed` can have written rows,
 * so the three cases never overlap and the caller can switch on one value
 * instead of reconciling flags that might contradict each other.
 */
export enum SyncStatus {
  Completed = 'completed',
  Throttled = 'throttled',
  Disconnected = 'disconnected',
}
