/**
 * Parsing and validation of AI output. Pure: content string in, validated
 * coaching notes out. No client, no cache, no env.
 *
 * This is the safety gate. Everything the model says is untrusted: it is
 * length-capped, type-checked, and any suggestion that could raise athlete risk
 * is dropped here — server-side. The client never applies a suggestion to the
 * rendered plan, and must not have to.
 */
import { z } from 'zod'
import { WORKOUT_TEMPLATES } from '@/modules/training/domain/templates.ts'
import type { AiSuggestion, AiWeekInput } from '@/modules/ai/domain/coaching-contract.ts'
import {
  MAX_EXPLANATION_CHARS,
  MAX_REASON_CHARS,
  MAX_SUGGESTED_TYPE_CHARS,
  MAX_SUGGESTIONS,
  distanceKm,
  sanitize,
} from '@/modules/ai/domain/coaching-contract.ts'

/** Workout types the model is allowed to propose at all. */
const AI_TRAINABLE_TYPES = new Set(Object.keys(WORKOUT_TEMPLATES))
/** Types that add intensity — gated on fatigue and weekly load. */
const HARD_TYPES = new Set(['tempo', 'threshold', 'interval'])

/** Provider output is untrusted: every field is optional and coerced leniently,
 *  then normalized below. Anything missing degrades to "no suggestion". */
const AIResponseSchema = z.object({
  weekExplanations: z.array(z.unknown()).max(8).optional(),
  suggestions: z.array(z.unknown()).max(8).optional(),
  confidence: z.unknown().optional(),
})

export type CoachingOutput =
  | {
      ok: true
      explanations: Record<number, string>
      suggestions: AiSuggestion[]
      confidence: number | null
    }
  | { ok: false; code: 'parse_failed' }

/** Some models wrap JSON in prose or a fence despite jsonMode. Tolerate that. */
function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end <= start) return content.trim()
  return content.slice(start, end + 1)
}

function normalizeExplanations(raw: unknown): Record<number, string> {
  if (!Array.isArray(raw)) return {}
  const out: Record<number, string> = {}
  raw.slice(0, 7).forEach((entry, index) => {
    const text = sanitize(entry, MAX_EXPLANATION_CHARS)
    if (text) out[index] = text
  })
  return out
}

/**
 * Reject any suggestion that could raise athlete risk. This is the server-side
 * gate; the client never applies a suggestion to the rendered plan anyway.
 */
function normalizeSuggestions(raw: unknown, input: AiWeekInput): AiSuggestion[] {
  if (!Array.isArray(raw)) return []
  const weekly = input.state?.weekly ?? {}
  const hasFatigue = (input.state?.fatigueSignals ?? []).length > 0
  const hardThisWeek = Number(weekly.hardSessions7 ?? 0)
  const out: AiSuggestion[] = []
  const seen = new Set<number>()

  for (const entry of raw) {
    if (out.length >= MAX_SUGGESTIONS) break
    if (!entry || typeof entry !== 'object') continue

    const dayIndex = Number((entry as any).dayIndex)
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) continue
    if (seen.has(dayIndex)) continue
    const day = input.week[dayIndex]
    if (!day) continue

    const suggestedType = sanitize((entry as any).suggestedType, MAX_SUGGESTED_TYPE_CHARS).toLowerCase()
    if (!AI_TRAINABLE_TYPES.has(suggestedType)) continue

    // Never touch a rest day.
    if (!AI_TRAINABLE_TYPES.has(day.workout.type)) continue

    // Never escalate intensity under fatigue or an already-hard week.
    if (HARD_TYPES.has(suggestedType) && (hasFatigue || hardThisWeek >= 2)) continue

    // Never grow the long run beyond what the engine planned. Reads
    // `distance_km` first — when this parsed only the old display string the
    // guard never fired and long runs could escalate freely.
    if (suggestedType === 'long') {
      const planned = distanceKm(day)
      const currentLong = Number(weekly.longRun7 ?? 0)
      if (planned != null && Number.isFinite(currentLong) && planned > currentLong + 2) continue
    }

    const reason = sanitize((entry as any).reason, MAX_REASON_CHARS)
    if (!reason) continue

    seen.add(dayIndex)
    out.push({ dayIndex, suggestedType, reason })
  }
  return out
}

function normalizeConfidence(raw: unknown): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(n, 0), 1)
}

/** Parse, validate and clamp a raw completion. Never throws. */
export function parseCoachingOutput(content: string, input: AiWeekInput): CoachingOutput {
  let parsed: any
  try {
    parsed = AIResponseSchema.parse(JSON.parse(extractJson(content)))
  } catch {
    return { ok: false, code: 'parse_failed' }
  }
  return {
    ok: true,
    explanations: normalizeExplanations(parsed.weekExplanations),
    suggestions: normalizeSuggestions(parsed.suggestions, input),
    confidence: normalizeConfidence(parsed.confidence),
  }
}
