// Strava streams forwarded to the charts and the 3D map untouched. Non-numeric
// samples (a dropped HR strap, a GPS gap) arrive as `null` so indexes stay aligned.
export interface ActivityStreams {
  time?: Array<number | null> | null
  distance?: Array<number | null> | null
  velocity_smooth?: Array<number | null> | null
  heartrate?: Array<number | null> | null
  latlng?: Array<[number, number] | null> | null
}
