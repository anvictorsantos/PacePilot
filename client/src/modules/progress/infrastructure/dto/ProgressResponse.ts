import type { GoalProgress } from './GoalProgress'
import type { PacePoint } from './PacePoint'
import type { PersonalRecord } from './PersonalRecord'
import type { TrainingState } from './TrainingState'
import type { VolumePoint } from './VolumePoint'

/** `GET /api/progress` — totals, series, training state and best efforts. */
export interface ProgressResponse {
  totalDistance?: number | null
  totalActivities?: number | null
  volumeSeries?: VolumePoint[] | null
  paceSeries?: PacePoint[] | null
  trainingState?: TrainingState | null
  goalProgress?: GoalProgress | null
  records?: PersonalRecord[] | null
}
