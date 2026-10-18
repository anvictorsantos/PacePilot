/** Strava streams, forwarded to the charts untouched. */
export interface ActivityStreams {
  time?: number[] | null
  distance?: number[] | null
  velocity_smooth?: number[] | null
  heartrate?: number[] | null
}
