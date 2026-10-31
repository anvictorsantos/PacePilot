import type { ActivityStreams } from '@/modules/activities/infrastructure/dto/ActivityStreams'
import type { Lap } from '@/modules/activities/infrastructure/dto/Lap'
import type { Trophy } from '@/modules/activities/infrastructure/dto/Trophy'

export interface Activity {
  id?: number | string | null
  _id?: number | string | null
  provider?: string | null
  provider_activity_id?: string | null
  name?: string | null
  date?: string | null
  start_date?: string | null
  /** When our row was created, not the run date: a sync always runs after the
   *  activity it imports, so the notification feed compares this and never `date`. */
  createdAt?: string | null
  /** When the row last changed. A provider correction moves it; a new import does not. */
  updatedAt?: string | null
  distance_m?: number | null
  distance_km?: number | null
  distance?: number | null
  moving_time?: number | null
  moving_time_min?: number | null
  moving_time_s?: number | null
  avg_pace_sec_km?: number | null
  average_speed?: number | null
  avg_hr?: number | null
  max_hr?: number | null
  elevation_m?: number | null
  avg_cadence?: number | null
  calories?: number | null
  workout_type?: string | null
  /** The canonical sport, and its provider label for tracing. */
  sport?: string | null
  sport_type?: string | null
  kind?: string | null
  achievement_count?: number | null
  pr_count?: number | null
  trophies?: Trophy[] | null
  laps?: Lap[] | null
  streams?: ActivityStreams | null
  analysis?: string | null
}
