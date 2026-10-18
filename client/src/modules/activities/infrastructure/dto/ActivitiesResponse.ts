import type { Activity } from '@/modules/activities/infrastructure/dto/Activity'

/** `GET /api/activities` — a page of runs. */
export interface ActivitiesResponse {
  items?: Activity[] | null
  total?: number | null
}
