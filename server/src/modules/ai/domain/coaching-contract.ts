/**
 * The contract between the deterministic Plan module and the AI layer.
 *
 * Two invariants, in order of importance:
 *   1. The deterministic engine owns the schedule. AI output may never change
 *      `workout.type`, `distance_km` or `duration_min`. It can only fill
 *      `aiExplanation` (prose) and `aiSuggestedType`/`aiSuggestionReason` (an
 *      explicitly-labelled, separately-validated suggestion).
 *   2. Nothing is billed. Models come from env (free-tier only, enforced in
 *      config/env.ts) and calls are cached per athlete-week because the free
 *      tier allows only 50 req/day below 10 credits purchased.
 *
 * Untrusted-input rule: athlete-controlled strings (notes, RPE text, activity
 * names) are interpolated into the prompt as DATA inside a delimited block and
 * the system prompt forbids following instructions found there. AI output is
 * schema-validated and length-capped before it reaches any client. Everything
 * in this file is shared by the two sides of that rule — the prompt builder and
 * the output validator — so the caps cannot drift apart.
 */

export interface AiDayInput {
  date: string
  workout: {
    type: string
    label?: string
    /** Numeric distance, when present. The shape the Plan module emits. */
    distance_km?: number | null
    /**
     * Legacy `"6 KM"` display string. The Plan module no longer produces it,
     * but historic payloads and the AI's own fallback paths still can, so both
     * shapes are accepted rather than silently blanking out the prompt.
     */
    distance?: string | number | null
  }
}

export interface AiWeekInput {
  athleteId: string
  /** Deterministic training state from training.service.ts. */
  state: any
  goal: any
  /** The authoritative deterministic week (7 entries). Read-only. */
  week: AiDayInput[]
  feedbacks?: any[]
  activities?: any[]
  weekKey: string
  /** Language of the coaching prose. Part of the cache key, so two locales for
   *  the same athlete-week are two independent entries rather than one serving
   *  the other's text. */
  locale: AiLocale
}

export interface AiSuggestion {
  dayIndex: number
  suggestedType: string
  reason: string
}

// --- locale ----------------------------------------------------------------
/** The languages the AI layer will write in, matching the app's catalogues.
 *  `pt` is the app default, so it is the default here too. */
export const AI_LOCALES = ['pt', 'en'] as const
export type AiLocale = (typeof AI_LOCALES)[number]
export const DEFAULT_AI_LOCALE: AiLocale = 'pt'

/** Portuguese runs longer than English for the same content; the explanation
 *  budget is in characters, so the word budget has to differ to stay inside it. */
export function explanationWordBudget(locale: AiLocale): number {
  return locale === 'pt' ? 18 : 20
}

export interface AiWeekResult {
  success: boolean
  /** Sparse: only days the model actually explained. */
  explanations: Record<number, string>
  suggestions: AiSuggestion[]
  confidence: number | null
  /** Which configured model answered. */
  model: string | null
  /** True when served from cache — no provider call was made. */
  cached: boolean
  /** Why AI is unavailable. Safe to surface; contains no secrets. */
  degraded: string | null
  code?: string
}

// --- caps ------------------------------------------------------------------
// One place, because the prompt's budget and the validator's truncation have to
// agree: a field the prompt invites at 240 chars must not be cut at 80 on the
// way back.
export const MAX_SUGGESTIONS = 3
export const MAX_EXPLANATION_CHARS = 240
export const MAX_REASON_CHARS = 160
export const MAX_SUGGESTED_TYPE_CHARS = 24
export const MAX_FEEDBACK_CHARS = 240

/** Distance in km from either shape. Returns null when genuinely absent —
 *  0 and "unknown" are different facts and must not be conflated. */
export function distanceKm(day: AiDayInput | undefined): number | null {
  if (!day) return null
  const numeric = day.workout?.distance_km
  if (typeof numeric === 'number' && Number.isFinite(numeric)) return numeric
  const raw = day.workout?.distance
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function formatDistanceKm(day: AiDayInput | undefined): string {
  const km = distanceKm(day)
  return km == null ? 'not set' : `${km}km`
}

/** Strip control characters and cap length. Applied to every athlete-supplied
 *  string on the way into the prompt and to every AI-authored string on the way
 *  out to the client. */
export function sanitize(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value : String(value ?? '')
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
