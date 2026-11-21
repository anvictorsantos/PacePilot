import type { PlanAiDay } from '@/modules/ai/infrastructure/dto/PlanAiDay'
import type { PlanAiSuggestion } from '@/modules/ai/infrastructure/dto/PlanAiSuggestion'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay'

/** `GET /api/plan/ai/week` — the explain layer over the deterministic week. */
export interface PlanAiWeekResponse {
  week?: PlanAiDay[] | null
  suggestions?: PlanAiSuggestion[] | null
  /** Engine-validated schedule when the coach's shape proposal was accepted. */
  schedule?: PlanDay[] | null
  model?: string | null
  /** True when served from the server cache — no provider call was made. */
  cached?: boolean
  confidence?: number | null
  /** Human-readable reason AI is unavailable. Safe to display. */
  degraded?: string | null
  code?: string | null
}
