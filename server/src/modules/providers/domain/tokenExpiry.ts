/**
 * When a stored provider grant counts as usable. Pure and clock-injected so the
 * decision can be tested without a database, exactly like the plan engine.
 *
 * Legacy providers stored the expiry in epoch **seconds** (`Athlete.expires_at`
 * stayed a `Number`), while `Connection.expires_at` is date-typed. Wherever the
 * seconds value crossed that boundary it was cast as milliseconds and landed in
 * January 1970, which made every read look stale and refresh on every call —
 * and refresh tokens rotate, so two readers raced and one stored a dead grant.
 */

/** A token more than this far from expiry is used as stored; no refresh call. */
export const FRESHNESS_WINDOW_MS = 60_000

/**
 * The earliest epoch-millisecond value a real token expiry can hold
 * (2001-09-09). Anything below it is an epoch-seconds value in a millisecond
 * field, never a genuine expiry — so a value under the floor is repaired, not
 * trusted.
 */
export const EARLIEST_PLAUSIBLE_EPOCH_MS = 1_000_000_000_000

/** What a lean Mongo document, a legacy column or a provider gives us. */
export type StoredExpiry = Date | number | string | null | undefined

/** Epoch milliseconds as stored, before the unit is believed. */
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
 * True when a date-typed value is an epoch-seconds value wearing millisecond
 * clothes. A plain number is never corrupted: it stays in the unit it was
 * written in, so the field it lives in is the only thing that ever lied.
 */
export function isExpiryCorrupted(value: StoredExpiry): boolean {
  if (typeof value === 'number') return false
  const ms = rawEpochMs(value)
  return ms !== null && ms > 0 && ms < EARLIEST_PLAUSIBLE_EPOCH_MS
}

/**
 * The expiry as a `Date`, in milliseconds, with a legacy seconds value (or a
 * date cast from one) repaired. `null` when nothing usable is stored — callers
 * treat that as stale.
 */
export function expiryFromStored(value: StoredExpiry): Date | null {
  const raw = rawEpochMs(value)
  if (raw === null || raw <= 0) return null
  const ms = raw < EARLIEST_PLAUSIBLE_EPOCH_MS ? raw * 1000 : raw
  // A repaired value still under the floor (e.g. 0) is not a real expiry.
  return ms < EARLIEST_PLAUSIBLE_EPOCH_MS ? null : new Date(ms)
}

/** A token is used as stored only when it outlives the freshness window. */
export function isTokenFresh(value: StoredExpiry, now: number = Date.now()): boolean {
  const expiresAt = expiryFromStored(value)
  return expiresAt !== null && expiresAt.getTime() > now + FRESHNESS_WINDOW_MS
}
