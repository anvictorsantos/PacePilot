import type { WeekMetaPrimitives } from '@/modules/training/domain/value-object/WeekMeta'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay'
import type { PlanProgramme } from '@/modules/training/infrastructure/dto/PlanProgramme'

/** `nextWeek` on `GET /api/plan/week` — the programme's plan for the following
 *  week. No `actual`, no adaptive pass: every day is `planned`. */
export interface PlanNextWeek {
  week?: PlanDay[] | null
  weekMeta?: WeekMetaPrimitives | null
  programme?: PlanProgramme | null
}
