// Orchestration only: the engine owns the schedule, AI fills prose and a
// labelled suggestion. Caching lives in the route so a hit skips the quota limiter.
import { OpenRouterClient } from '@/modules/ai/infrastructure/openrouter-client.ts'
import type { OpenRouterMessage, OpenRouterResult } from '@/modules/ai/infrastructure/openrouter-client.ts'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { buildCoachingMessages } from '@/modules/ai/application/coaching-prompt.ts'
import { parseCoachingOutput } from '@/modules/ai/infrastructure/coaching-output.ts'
import { cacheTtlMs } from '@/modules/ai/application/quota-cache.ts'
import type {
  AiDayInput,
  AiWeekInput,
  AiWeekPayload,
  AiWeekResult,
} from '@/modules/ai/domain/coaching-contract.ts'

export type {
  AiDayInput,
  AiWeekInput,
  AiSuggestion,
  AiWeekPayload,
  AiWeekResult,
} from '@/modules/ai/domain/coaching-contract.ts'
export { clearAiCache, clearAiCacheForAthlete, cacheGet, cacheSet, aiCacheKey } from '@/modules/ai/application/quota-cache.ts'

/** The id every cache key is built from; the fallback model must not fragment it. */
export const aiModel = env.openRouterModel

function degrade(message: string, code: string): AiWeekResult {
  return {
    success: false,
    explanations: {},
    suggestions: [],
    confidence: null,
    model: null,
    degraded: message,
    code,
  }
}

/** Provider codes → copy safe to show an athlete: never echoes a provider error body. */
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
    appUrl: env.appUrl,
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

    const messages = buildCoachingMessages(input)
    let result: OpenRouterResult = await primary.chat(messages, { jsonMode: true })
    let model = primary.model
    let triedFallback = false

    // Retried on transient failure or a retired id; only free ids survive env boot.
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
      // Never cache failures: outages are transient and the next request should retry.
      const message = DEGRADE_MESSAGES[result.code] || 'AI is unavailable'
      return degrade(message, result.code)
    }

    let content = result.response?.choices?.[0]?.message?.content
    if (!content && fallback && !triedFallback) {
      // Usually the token budget ran out before any visible output; one fallback try.
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
      degraded: null,
    }

    return output
  }
}

export const trainingAI = createTrainingAIService()

interface AiWeekDay {
  date: string
  aiExplanation: string | null
  aiSuggestedType: string | null
  aiSuggestionReason: string | null
}

/** The `/api/plan/ai/week` body. An empty `week` with a `code` is "no coaching copy", not an error. */
export function buildAiWeekPayload(week: AiDayInput[], result: AiWeekResult): AiWeekPayload {
  if (!result.success) {
    return {
      week: [],
      suggestions: [],
      enabled: true,
      degraded: result.degraded,
      code: result.code,
    }
  }
  const days: AiWeekDay[] = week.map((day, index) => ({
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
    // The route sets this on a cache hit; a freshly built body is never one.
    cached: false,
    confidence: result.confidence,
    degraded: null,
  }
}

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

/** GET /models is free and not quota-bound, so this is safe on demand. */
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
    const { listFreeModels } = await import('@/modules/ai/infrastructure/openrouter-client.ts')
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
