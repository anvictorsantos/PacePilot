/**
 * Pure and clock-injected so the decision is testable without a database.
 *
 * Legacy providers stored expiry in epoch seconds where a date was expected; the
 * cast landed in 1970, so every read looked stale and refresh raced on rotation.
 */

/** A token more than this far from expiry is used as stored; no refresh call. */
export const FRESHNESS_WINDOW_MS = 60_000

/**
 * Epoch-ms floor (2001-09-09): anything below is an epoch-seconds value in a
 * millisecond field, so it is repaired, not trusted.
 */
export const EARLIEST_PLAUSIBLE_EPOCH_MS = 1_000_000_000_000

/** What a lean Mongo document, a legacy column or a provider gives us. */
export type StoredExpiry = Date | number | string | null | undefined

function rawEpochMs(value: StoredExpiry): number | null {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    if (value.trim() === '') return null
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

/**
 * A plain number is never corrupted: it stays in the unit it was written in, so
 * only a date-typed field can lie.
 */
export function isExpiryCorrupted(value: StoredExpiry): boolean {
  if (typeof value === 'number') return false
  const ms = rawEpochMs(value)
  return ms !== null && ms > 0 && ms < EARLIEST_PLAUSIBLE_EPOCH_MS
}

/**
 * The expiry as a `Date` in ms, with a legacy seconds value repaired; `null` when
 * nothing usable is stored — callers treat that as stale.
 */
export function expiryFromStored(value: StoredExpiry): Date | null {
  const raw = rawEpochMs(value)
  if (raw === null || raw <= 0) return null
  const ms = raw < EARLIEST_PLAUSIBLE_EPOCH_MS ? raw * 1000 : raw
  // A repaired value still under the floor (e.g. 0) is not a real expiry.
  return ms < EARLIEST_PLAUSIBLE_EPOCH_MS ? null : new Date(ms)
}

export function isTokenFresh(value: StoredExpiry, now: number = Date.now()): boolean {
  const expiresAt = expiryFromStored(value)
  return expiresAt !== null && expiresAt.getTime() > now + FRESHNESS_WINDOW_MS
}
