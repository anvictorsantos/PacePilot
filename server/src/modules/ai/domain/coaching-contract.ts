// The deterministic engine owns the schedule: AI may only fill prose and the
// labelled suggestion. Caps live here so prompt budget and validator cannot drift.

export interface AiDayInput {
  date: string
  workout: {
    type: string
    label?: string
    distance_km?: number | null
    // Legacy `"6 KM"` display string: historic payloads and the AI's own fallback
    // paths still emit it, so both shapes are accepted rather than blanking the prompt.
    distance?: string | number | null
  }
}

export interface AiWeekInput {
  athleteId: string
  state: any
  goal: any
  /** The authoritative deterministic week (7 entries). Read-only. */
  week: AiDayInput[]
  feedbacks?: any[]
  activities?: any[]
  weekKey: string
  // Part of the cache key: two locales for one athlete-week are independent
  // entries rather than one serving the other's text.
  locale: AiLocale
}

export interface AiSuggestion {
  dayIndex: number
  suggestedType: string
  reason: string
}

// Must match the app's catalogues; `pt` is the app default, so it is the default here.
export const AI_LOCALES = ['pt', 'en'] as const
export type AiLocale = (typeof AI_LOCALES)[number]
export const DEFAULT_AI_LOCALE: AiLocale = 'pt'

// Portuguese runs longer per character budget, so it gets fewer words.
export function explanationWordBudget(locale: AiLocale): number {
  return locale === 'pt' ? 18 : 20
}

export interface AiWeekResult {
  success: boolean
  /** Sparse: only days the model actually explained. */
  explanations: Record<number, string>
  suggestions: AiSuggestion[]
  confidence: number | null
  model: string | null
  /** Safe to surface; contains no secrets. */
  degraded: string | null
  code?: string
}

/** One day's AI-authored fields on the wire. Never carries schedule data. */
export interface AiWeekDayPayload {
  date: string
  aiExplanation: string | null
  aiSuggestedType: string | null
  aiSuggestionReason: string | null
}

// The `/api/plan/ai/week` body, and the exact object the cache stores: a hit must
// answer without rebuilding the deterministic week, so the payload is the cached unit.
export interface AiWeekPayload {
  week: AiWeekDayPayload[]
  suggestions: AiSuggestion[]
  /** Present on the degraded branch: AI is configured, this week has no copy. */
  enabled?: boolean
  model?: string | null
  cached?: boolean
  confidence?: number | null
  degraded?: string | null
  code?: string
}

// Prompt budget and validator truncation must agree: a field invited at 240 chars
// must not be cut at 80 on the way back.
export const MAX_SUGGESTIONS = 3
export const MAX_EXPLANATION_CHARS = 240
export const MAX_REASON_CHARS = 160
export const MAX_SUGGESTED_TYPE_CHARS = 24
export const MAX_FEEDBACK_CHARS = 240

// Null means genuinely absent: 0 and "unknown" are different facts.
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

// Applied to athlete input entering the prompt and to AI output reaching the client.
export function sanitize(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value : String(value ?? '')
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
