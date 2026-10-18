import type { TrainingWeekly } from '@/modules/progress/infrastructure/dto/TrainingWeekly'

/** What the engine reads off the athlete's recent running. */
export interface TrainingState {
  weekly?: TrainingWeekly | null
  trend?: string | null
  fatigueSignals?: string[] | null
}
