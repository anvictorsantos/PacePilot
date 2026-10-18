/**
 * Port for the "this only ever counts once" marks the client keeps locally —
 * today, that a session has already been seen on this browser.
 *
 * It exists because the server's OAuth redirect (`/login?connected=1`) does not
 * say whether the athlete is new; this is the closest honest signal the client
 * has, and naming it says so.
 */
export interface SignupMarker {
  /** True when a session has already been recorded on this browser. */
  sent(): boolean
  remember(): void
}
