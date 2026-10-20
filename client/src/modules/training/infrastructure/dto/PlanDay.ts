import type { PlanDayActual } from '@/modules/training/infrastructure/dto/PlanDayActual'
import type { PlanWorkout } from '@/modules/training/infrastructure/dto/PlanWorkout'

/** One day of the week payload. */
export interface PlanDay {
  date?: string | null
  isToday?: boolean
  /** Deterministic programme role (phase / long-run target), computed server-side. */
  programmeRole?: string | null
  workout?: PlanWorkout | null
  /** The run actually completed on this date, for finished days. */
  actual?: PlanDayActual | null
}
