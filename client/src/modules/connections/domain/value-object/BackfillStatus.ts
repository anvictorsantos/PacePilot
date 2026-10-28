/**
 * The historical-import states the server reports. One enum for the wire
 * strings, the Settings copy and the driver's decisions, so a new state cannot
 * render as a blank label or be mistaken for "still walking".
 */
export enum BackfillStatus {
  Idle = 'idle',
  Pending = 'pending',
  Running = 'running',
  Paused = 'paused',
  Complete = 'complete',
  Failed = 'failed',
}

export const BACKFILL_STATUSES: readonly BackfillStatus[] = Object.values(BackfillStatus)

/** Any wire value — an unknown state reads as "idle", never as progress. */
export function toBackfillStatus(value: unknown): BackfillStatus {
  const key = String(value ?? '')
  return (BACKFILL_STATUSES as readonly string[]).includes(key)
    ? (key as BackfillStatus)
    : BackfillStatus.Idle
}

export function isBackfillComplete(status: BackfillStatus): boolean {
  return status === BackfillStatus.Complete
}

/** Another caller holds the cursor; this one must not walk alongside it. */
export function isBackfillRunning(status: BackfillStatus): boolean {
  return status === BackfillStatus.Running
}

export function isBackfillFailed(status: BackfillStatus): boolean {
  return status === BackfillStatus.Failed
}
