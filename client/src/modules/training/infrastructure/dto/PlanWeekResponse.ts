import type { Goal } from '@/modules/goals/infrastructure/dto/Goal'
import type { WeekMetaPrimitives } from '@/modules/training/domain/value-object/WeekMeta'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay'
import type { PlanProgramme } from '@/modules/training/infrastructure/dto/PlanProgramme'

/** `GET /api/plan/week` — the Mon–Sun week, its meta and the goal behind it. */
export interface PlanWeekResponse {
  week?: PlanDay[] | null
  weekMeta?: WeekMetaPrimitives | null
  goal?: Goal | null
  programme?: PlanProgramme | null
}
