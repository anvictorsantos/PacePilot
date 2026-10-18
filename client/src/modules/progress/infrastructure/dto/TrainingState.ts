import type { TrainingWeekly } from './TrainingWeekly'

/** What the engine reads off the athlete's recent running. */
export interface TrainingState {
  weekly?: TrainingWeekly | null
  trend?: string | null
  fatigueSignals?: string[] | null
}
