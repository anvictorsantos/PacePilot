/**
 * Port for the "this only ever counts once" marks the client keeps locally —
 * today, that a session has already been seen on this browser.
 *
 * It exists because a successful registration does not say whether this browser
 * has already been counted; this is the closest honest signal the client has,
 * and naming it says so.
 */
export interface SignupMarker {
  /** True when a session has already been recorded on this browser. */
  sent(): boolean
  remember(): void
}
