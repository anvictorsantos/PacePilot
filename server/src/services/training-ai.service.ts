/**
 * Training AI service — orchestration only.
 *
 * It owns three things and nothing else: the provider clients (primary +
 * explicitly-configured free fallback), the degrade-not-throw error contract,
 * and the shape of what the routes return. The prompt lives in
 * ai/coaching-prompt.ts, validation and the risk gate in ai/coaching-output.ts,
 * the quota cache in ai/quota-cache.ts.
 *
 * Invariants: the deterministic engine owns the schedule (AI may only fill
 * prose and a separately-labelled suggestion), and nothing is billed (free-tier
 * models only, cached per athlete-week).
 */
import { OpenRouterClient } from './openrouter-client.ts'
import type { OpenRouterMessage, OpenRouterResult } from './openrouter-client.ts'
import { env } from '../config/env.ts'
import { buildCoachingMessages } from './ai/coaching-prompt.ts'
import { parseCoachingOutput } from './ai/coaching-output.ts'
import { cacheGet, cacheSet, cacheTtlMs } from './ai/quota-cache.ts'
import type { AiDayInput, AiWeekInput, AiWeekResult } from './ai/coaching-contract.ts'

// The module's public contract, re-exported so callers have one import site for
// "everything AI" rather than reaching into ai/ for types and here for values.
export type { AiDayInput, AiWeekInput, AiSuggestion, AiWeekResult } from './ai/coaching-contract.ts'
export { clearAiCache } from './ai/quota-cache.ts'

function degrade(message: string, code: string): AiWeekResult {
  return {
    success: false,
    explanations: {},
    suggestions: [],
    confidence: null,
    model: null,
    cached: false,
    degraded: message,
    code,
  }
}

/** Provider codes mapped to copy safe to show an athlete — names no internals
 *  and never echoes a provider error body. */
const DEGRADE_MESSAGES: Record<string, string> = {
  rate_limited: 'AI free-tier quota exhausted — try again later',
  timeout: 'AI request timed out',
  network: 'AI provider unreachable',
  auth_failed: 'AI provider rejected the API key',
  no_api_key: 'AI is not configured (missing OPENROUTER_API_KEY)',
  payment_required: 'AI provider rejected the request for billing reasons',
  model_unavailable: 'Configured AI model is unavailable',
  bad_request: 'AI request rejected by provider',
  server_error: 'AI provider error',
  disabled: 'AI is disabled',
  bad_response: 'AI provider returned an unusable response',
}

// --- clients ---------------------------------------------------------------

export interface TrainingAIServiceDeps {
  primary: OpenRouterClient
  fallback: OpenRouterClient | null
  fallbackModel: string
}

function clientFromEnv(model: string): OpenRouterClient {
  return new OpenRouterClient({
    apiKey: env.openRouterApiKey,
    baseUrl: env.openRouterBaseUrl,
    model,
    timeoutMs: env.openRouterTimeoutMs,
    enabled: env.openRouterEnabled,
    temperature: env.openRouterTemperature,
    maxTokens: env.openRouterMaxTokens,
    maxRetries: env.openRouterMaxRetries,
    retryBaseMs: env.openRouterRetryBaseMs,
    reasoningMaxTokens: env.openRouterReasoningMaxTokens,
    appUrl: env.clientUrl.split(',')[0]?.trim(),
    appTitle: 'PacePilot',
  })
}

export function createTrainingAIService(overrides: Partial<TrainingAIServiceDeps> = {}) {
  const primary = overrides.primary ?? clientFromEnv(env.openRouterModel)
  const fallbackModel = overrides.fallbackModel ?? env.openRouterFallbackModel
  const fallback =
    overrides.fallback !== undefined
      ? overrides.fallback
      : fallbackModel && fallbackModel !== env.openRouterModel
        ? clientFromEnv(fallbackModel)
        : null

  return async function enhanceWeek(input: AiWeekInput): Promise<AiWeekResult> {
    if (!env.openRouterEnabled) {
      return degrade('AI is disabled (OPENROUTER_ENABLED=false)', 'disabled')
    }
    if (!env.openRouterApiKey) {
      return degrade('AI is not configured (missing OPENROUTER_API_KEY)', 'no_api_key')
    }

    const cacheKey = `${input.athleteId}:${input.weekKey}:${primary.model}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached

    const messages = buildCoachingMessages(input)
    let result: OpenRouterResult = await primary.chat(messages, { jsonMode: true })
    let model = primary.model
    let triedFallback = false

    // Retry the second model when the first failed transiently or is no longer
    // served. Never a paid model — config/env.ts rejects non-":free" ids at boot.
    const worthRetrying = (r: OpenRouterResult) =>
      !r.success && (r.retryable || r.code === 'model_unavailable')
    if (worthRetrying(result) && fallback && !triedFallback) {
      triedFallback = true
      const retried = await fallback.chat(messages, { jsonMode: true })
      if (retried.success) {
        result = retried
        model = fallback.model
      }
    }

    if (!result.success) {
      // Never cache failures: quota errors and outages are transient and we want
      // the next request to actually retry.
      const message = DEGRADE_MESSAGES[result.code] || 'AI is unavailable'
      return degrade(message, result.code)
    }

    let content = result.response?.choices?.[0]?.message?.content
    if (!content && fallback && !triedFallback) {
      // Most often the token budget was consumed before any visible output.
      // Worth one attempt at the second configured free model.
      triedFallback = true
      const retried = await fallback.chat(messages, { jsonMode: true })
      if (retried.success) {
        result = retried
        model = fallback.model
        content = retried.response?.choices?.[0]?.message?.content
      }
    }
    if (!content) {
      return degrade('AI provider returned an empty response', 'empty_response')
    }

    const parsed = parseCoachingOutput(content, input)
    if (!parsed.ok) {
      return degrade('AI response did not match the expected format', parsed.code)
    }

    const output: AiWeekResult = {
      success: true,
      explanations: parsed.explanations,
      suggestions: parsed.suggestions,
      confidence: parsed.confidence,
      model,
      cached: false,
      degraded: null,
    }

    cacheSet(cacheKey, output)
    return output
  }
}

export const trainingAI = createTrainingAIService()

// --- wire shape ------------------------------------------------------------

/**
 * The `/api/plan/ai/week` body. Owned here rather than in the route so the AI
 * layer decides what a degraded week looks like — the client shows the plan
 * either way, and an empty `week` with a `code` is the "no coaching copy"
 * answer, not an error.
 */
export function buildAiWeekPayload(week: AiDayInput[], result: AiWeekResult) {
  if (!result.success) {
    return {
      week: [],
      suggestions: [],
      enabled: true,
      degraded: result.degraded,
      code: result.code,
    }
  }
  const days = week.map((day, index) => ({
    date: day.date,
    aiExplanation: result.explanations[index] ?? null,
    aiSuggestedType: null,
    aiSuggestionReason: null,
  }))
  for (const s of result.suggestions) {
    days[s.dayIndex].aiSuggestedType = s.suggestedType
    days[s.dayIndex].aiSuggestionReason = s.reason
  }
  return {
    week: days,
    suggestions: result.suggestions,
    model: result.model,
    cached: result.cached,
    confidence: result.confidence,
    degraded: null,
  }
}

// --- status ----------------------------------------------------------------

export interface AiStatus {
  enabled: boolean
  configured: boolean
  model: string
  fallbackModel: string | null
  cacheTtlMs: number
  freeModels: Array<{ id: string; supportsJsonMode: boolean }>
  modelStillFree: boolean | null
  catalogError: string | null
}

/**
 * Runtime free-tier check. GET /models is free and not quota-bound, so this is
 * safe to call on demand — it is how a stale model id becomes visible.
 */
export async function aiStatus(): Promise<AiStatus> {
  const base = {
    enabled: env.openRouterEnabled,
    configured: Boolean(env.openRouterApiKey),
    model: env.openRouterModel,
    fallbackModel:
      env.openRouterFallbackModel && env.openRouterFallbackModel !== env.openRouterModel
        ? env.openRouterFallbackModel
        : null,
    cacheTtlMs,
  }
  if (!env.openRouterEnabled) {
    return { ...base, freeModels: [], modelStillFree: null, catalogError: null }
  }
  try {
    const { listFreeModels } = await import('./openrouter-client.ts')
    const free = await listFreeModels({
      baseUrl: env.openRouterBaseUrl,
      apiKey: env.openRouterApiKey,
      timeoutMs: env.openRouterTimeoutMs,
    })
    const ids = new Set(free.map(m => m.id))
    return {
      ...base,
      freeModels: free.map(m => ({ id: m.id, supportsJsonMode: m.supportsJsonMode })),
      modelStillFree: ids.has(env.openRouterModel),
      catalogError: null,
    }
  } catch (err) {
    // Never surface provider error bodies — they can echo request content.
    return {
      ...base,
      freeModels: [],
      modelStillFree: null,
      catalogError: (err as Error)?.name || 'catalog_unavailable',
    }
  }
}
