import type { TrainingState } from '@/modules/progress/infrastructure/dto/TrainingState'
import type { PlanRecommendation } from '@/modules/training/infrastructure/dto/PlanRecommendation'
import type { PlanWorkout } from '@/modules/training/infrastructure/dto/PlanWorkout'

/** `GET /api/plan/today` — today's prescription, already adapted. */
export interface PlanTodayResponse {
  date?: string | null
  isRest?: boolean
  recommendation?: PlanRecommendation | null
  workout?: PlanWorkout | null
  /** Set when recent Feedback or Deviation changed the prescription. */
  adapted?: { reason?: string | null } | null
  training_state?: TrainingState | null
}
