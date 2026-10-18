import type { Activity } from './Activity'

/** `GET /api/activities` — a page of runs. */
export interface ActivitiesResponse {
  items?: Activity[] | null
  total?: number | null
}
