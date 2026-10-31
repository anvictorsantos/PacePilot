import type { GoalProgress } from '@/modules/progress/infrastructure/dto/GoalProgress'
import type { PacePoint } from '@/modules/progress/infrastructure/dto/PacePoint'
import type { PersonalRecord } from '@/modules/progress/infrastructure/dto/PersonalRecord'
import type { TrainingState } from '@/modules/progress/infrastructure/dto/TrainingState'
import type { VolumePoint } from '@/modules/progress/infrastructure/dto/VolumePoint'

export interface ProgressResponse {
  totalDistance?: number | null
  totalActivities?: number | null
  volumeSeries?: VolumePoint[] | null
  paceSeries?: PacePoint[] | null
  trainingState?: TrainingState | null
  goalProgress?: GoalProgress | null
  records?: PersonalRecord[] | null
}
