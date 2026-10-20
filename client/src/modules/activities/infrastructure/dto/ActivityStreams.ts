/**
 * Strava streams, forwarded to the charts and the 3D map untouched.
 * Non-numeric samples (a HR strap that dropped out, a GPS gap) arrive as `null`
 * so the arrays stay index-aligned.
 */
export interface ActivityStreams {
  time?: Array<number | null> | null
  distance?: Array<number | null> | null
  velocity_smooth?: Array<number | null> | null
  heartrate?: Array<number | null> | null
  /** `[latitude, longitude]` per sample. */
  latlng?: Array<[number, number] | null> | null
}
