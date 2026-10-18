import type { PlanWorkout } from './PlanWorkout'

/** One day of the week payload. */
export interface PlanDay {
  date?: string | null
  isToday?: boolean
  /** Deterministic programme role (phase / long-run target), computed server-side. */
  programmeRole?: string | null
  workout?: PlanWorkout | null
}
