// Orchestration only: the engine owns the schedule, AI fills prose and a
// labelled suggestion. Caching lives in the route so a hit skips the quota limiter.
import { OpenCodeClient } from '@/modules/ai/infrastructure/opencode-client.ts'
import type { OpenCodeMessage, OpenCodeResult } from '@/modules/ai/infrastructure/opencode-client.ts'
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
export const aiModel = env.openCodeModel

function degrade(message: string, code: string): AiWeekResult {
  // The athlete only ever sees `degraded`; the code is the only triage signal left.
  // Config states are already warned for at boot and would drown the real failures.
  if (code !== 'disabled' && code !== 'no_api_key') {
    console.warn(`[ai] coaching degraded: code=${code} model=${aiModel}`)
  }
  return {
    success: false,
    explanations: {},
    suggestions: [],
    shape: null,
    confidence: null,
    model: null,
    degraded: message,
    code,
  }
}

/** Provider codes → copy safe to show an athlete: never echoes a provider error body. */
const DEGRADE_MESSAGES: Record<string, string> = {
  rate_limited: 'AI quota exhausted — try again later',
  timeout: 'AI request timed out',
  network: 'AI provider unreachable',
  auth_failed: 'AI provider rejected the API key',
  no_api_key: 'AI is not configured (missing OPENCODE_API_KEY)',
  payment_required: 'AI provider rejected the request for billing reasons',
  model_unavailable: 'Configured AI model is unavailable',
  bad_request: 'AI request rejected by provider',
  server_error: 'AI provider error',
  disabled: 'AI is disabled',
  bad_response: 'AI provider returned an unusable response',
}

export interface TrainingAIServiceDeps {
  primary: OpenCodeClient
  fallback: OpenCodeClient | null
  fallbackModel: string
}

function clientFromEnv(model: string): OpenCodeClient {
  return new OpenCodeClient({
    apiKey: env.openCodeApiKey,
    baseUrl: env.openCodeBaseUrl,
    model,
    timeoutMs: env.openCodeTimeoutMs,
    enabled: env.openCodeEnabled,
    temperature: env.openCodeTemperature,
    maxTokens: env.openCodeMaxTokens,
    maxRetries: env.openCodeMaxRetries,
    retryBaseMs: env.openCodeRetryBaseMs,
    reasoningEffort: env.openCodeReasoningEffort,
  })
}

export function createTrainingAIService(overrides: Partial<TrainingAIServiceDeps> = {}) {
  const primary = overrides.primary ?? clientFromEnv(env.openCodeModel)
  const fallbackModel = overrides.fallbackModel ?? env.openCodeFallbackModel
  const fallback =
    overrides.fallback !== undefined
      ? overrides.fallback
      : fallbackModel && fallbackModel !== env.openCodeModel
        ? clientFromEnv(fallbackModel)
        : null

  return async function enhanceWeek(input: AiWeekInput): Promise<AiWeekResult> {
    if (!env.openCodeEnabled) {
      return degrade('AI is disabled (OPENCODE_ENABLED=false)', 'disabled')
    }
    if (!env.openCodeApiKey) {
      return degrade('AI is not configured (missing OPENCODE_API_KEY)', 'no_api_key')
    }

    const messages = buildCoachingMessages(input)
    // Stable per athlete-week so Console can route and reuse its prompt cache.
    const sessionId = `ses_pacepilot_${input.athleteId}_${input.weekKey}`.replace(/[^a-zA-Z0-9_-]/g, '-')
    let result: OpenCodeResult = await primary.chat(messages, { jsonMode: true, sessionId })
    let model = primary.model
    let triedFallback = false

    // Retried on transient failure or a retired id; the fallback is a distinct model.
    const worthRetrying = (r: OpenCodeResult) =>
      !r.success && (r.retryable || r.code === 'model_unavailable')
    if (worthRetrying(result) && fallback && !triedFallback) {
      triedFallback = true
      const retried = await fallback.chat(messages, { jsonMode: true, sessionId })
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
      const retried = await fallback.chat(messages, { jsonMode: true, sessionId })
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
      shape: parsed.shape,
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
  /** null when no distinct fallback is configured or the catalogue is unreachable. */
  fallbackModelStillFree: boolean | null
  catalogError: string | null
}

/** GET /models is free and not quota-bound, so this is safe on demand. */
export async function aiStatus(): Promise<AiStatus> {
  const base = {
    enabled: env.openCodeEnabled,
    configured: Boolean(env.openCodeApiKey),
    model: env.openCodeModel,
    fallbackModel:
      env.openCodeFallbackModel && env.openCodeFallbackModel !== env.openCodeModel
        ? env.openCodeFallbackModel
        : null,
    cacheTtlMs,
  }
  if (!env.openCodeEnabled) {
    return {
      ...base,
      freeModels: [],
      modelStillFree: null,
      fallbackModelStillFree: null,
      catalogError: null,
    }
  }
  try {
    const { listFreeModels } = await import('@/modules/ai/infrastructure/opencode-client.ts')
    const free = await listFreeModels({
      baseUrl: env.openCodeBaseUrl,
      apiKey: env.openCodeApiKey,
      timeoutMs: env.openCodeTimeoutMs,
    })
    const ids = new Set(free.map(m => m.id))
    return {
      ...base,
      freeModels: free.map(m => ({ id: m.id, supportsJsonMode: m.supportsJsonMode })),
      modelStillFree: ids.has(env.openCodeModel),
      // A retired fallback id is the usual reason a transient primary failure
      // degrades instead of failing over, so it gets its own answer.
      fallbackModelStillFree: base.fallbackModel ? ids.has(base.fallbackModel) : null,
      catalogError: null,
    }
  } catch (err) {
    // Never surface provider error bodies — they can echo request content.
    return {
      ...base,
      freeModels: [],
      modelStillFree: null,
      fallbackModelStillFree: null,
      catalogError: (err as Error)?.name || 'catalog_unavailable',
    }
  }
}
