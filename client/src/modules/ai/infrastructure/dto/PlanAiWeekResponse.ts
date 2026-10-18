import type { PlanAiDay } from './PlanAiDay'
import type { PlanAiSuggestion } from './PlanAiSuggestion'

/** `GET /api/plan/ai/week` — the explain layer over the deterministic week. */
export interface PlanAiWeekResponse {
  week?: PlanAiDay[] | null
  suggestions?: PlanAiSuggestion[] | null
  model?: string | null
  /** True when served from the server cache — no provider call was made. */
  cached?: boolean
  confidence?: number | null
  /** Human-readable reason AI is unavailable. Safe to display. */
  degraded?: string | null
  code?: string | null
}
