/** A Strava segment effort the run earned. */
export interface Trophy {
  segment?: string | null
  label?: string | null
  /** Seconds. */
  time?: number | null
  type?: string | null
}
