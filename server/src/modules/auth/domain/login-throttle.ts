export const MAX_FAILED_LOGINS = 5
export const BASE_LOCK_MINUTES = 15
export const MAX_LOCK_MINUTES = 240

/** 0 below the threshold, then 15, 30, 60, 120, 240 minutes. */
export function lockDurationMinutes(failedCount: number): number {
  if (!Number.isFinite(failedCount) || failedCount < MAX_FAILED_LOGINS) return 0
  const exponent = failedCount - MAX_FAILED_LOGINS
  return Math.min(BASE_LOCK_MINUTES * 2 ** exponent, MAX_LOCK_MINUTES)
}

export function isLocked(
  lockedUntil: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lockedUntil) return false
  const until = lockedUntil instanceof Date ? lockedUntil : new Date(lockedUntil)
  return Number.isFinite(until.getTime()) && until.getTime() > now.getTime()
}
