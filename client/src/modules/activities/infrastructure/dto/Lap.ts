export interface Lap {
  index?: number | null
  /** Metres, Strava convention. */
  distance?: number | null
  moving_time?: number | null
  elapsed_time?: number | null
  avg_heartrate?: number | null
  elev?: number | null
  elevation_gain?: number | null
  avg_pace_sec_km?: number | null
}
