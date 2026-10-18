// OpenRouter — server-side only, never checked into client bundles.
// Provider-isolated: business logic (training-ai.service.ts) depends on the
// OpenRouterResult shape, not on axios or OpenRouter's wire format. Swapping
// providers means replacing this file only.
//
// Cost posture: free-tier only. Callers cannot pick a model — the id comes from
// env, and config/env.ts refuses to boot on a non-":free" id. Retries are
// bounded and only fire on transient failures, so a failing provider cannot
// turn into a retry loop against a 50 req/day quota.
import axios, { AxiosError } from 'axios'

export interface OpenRouterConfig {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  enabled: boolean
  temperature: number
  maxTokens: number
  maxRetries: number
  retryBaseMs: number
  /** Token budget for a reasoning model's internal thinking. 0 disables it.
   *  Without this, reasoning tokens silently consume max_tokens and the call
   *  can return an empty completion. */
  reasoningMaxTokens: number
  appUrl?: string
  appTitle?: string
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterChoice {
  index: number
  message: {
    role: string
    content: string
  }
  finish_reason: string | null
}

export interface OpenRouterUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface OpenRouterChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: OpenRouterChoice[]
  usage: OpenRouterUsage
}

// Declared as a `type` alias, not `interface A {...} | {...}`: Node's
// strip-only TS loader (--experimental-strip-types) cannot erase a union of
// interface bodies and fails with ERR_INVALID_TYPESCRIPT_SYNTAX.
export type OpenRouterResult =
  | { success: true; response: OpenRouterChatResponse }
  | {
      success: false
      error: Error
      /** Machine-readable reason for metrics/tests. Never surfaced to clients raw. */
      code: OpenRouterErrorCode
      /** True when a retry could plausibly succeed later (caller may back off). */
      retryable: boolean
    }

export type OpenRouterErrorCode =
  | 'disabled'
  | 'no_api_key'
  | 'timeout'
  | 'rate_limited'
  | 'auth_failed'
  | 'payment_required'
  | 'model_unavailable'
  | 'bad_request'
  | 'server_error'
  | 'network'
  | 'bad_response'

export interface ChatOptions {
  /** Ask the provider for JSON-only output. Only pass when the model advertises
   *  `response_format` support — otherwise providers 400. */
  jsonMode?: boolean
  temperature?: number
  maxTokens?: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** 429/5xx/network are transient. 400/401/402/403 are not — retrying them just
 *  burns quota, so they fail fast. */
function classify(err: AxiosError): { code: OpenRouterErrorCode; retryable: boolean } {
  const status = err.response?.status
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return { code: 'timeout', retryable: true }
  }
  if (!err.response) return { code: 'network', retryable: true }
  if (status === 429) return { code: 'rate_limited', retryable: true }
  if (status === 401) return { code: 'auth_failed', retryable: false }
  if (status === 402) return { code: 'payment_required', retryable: false }
  if (status === 404) return { code: 'model_unavailable', retryable: false }
  if (status === 400 || status === 422) return { code: 'bad_request', retryable: false }
  if (status === 403) return { code: 'auth_failed', retryable: false }
  if (status != null && status >= 500) return { code: 'server_error', retryable: true }
  return { code: 'bad_response', retryable: false }
}

/** Respect Retry-After when the provider sends one, else exponential backoff. */
function retryDelayMs(err: AxiosError, attempt: number, baseMs: number): number {
  const header = err.response?.headers?.['retry-after']
  const secs = Number(Array.isArray(header) ? header[0] : header)
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 30000)
  return baseMs * 2 ** attempt
}

export class OpenRouterClient {
  private config: OpenRouterConfig

  constructor(config: OpenRouterConfig) {
    this.config = config
  }

  get model() {
    return this.config.model
  }

  get available() {
    return this.config.enabled && Boolean(this.config.apiKey)
  }

  /**
   * Send a chat completion. `messages` is the full conversation — pass prior
   * turns for multi-turn context; the caller owns the history.
   */
  async chat(
    messages: OpenRouterMessage[],
    options: ChatOptions = {}
  ): Promise<OpenRouterResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: new Error('OpenRouter disabled or no API key configured'),
        code: 'disabled',
        retryable: false,
      }
    }
    if (!this.config.apiKey) {
      return {
        success: false,
        error: new Error('OpenRouter authentication failed — check API key'),
        code: 'no_api_key',
        retryable: false,
      }
    }

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: options.temperature ?? this.config.temperature,
      max_tokens: options.maxTokens ?? this.config.maxTokens,
    }
    if (options.jsonMode) body.response_format = { type: 'json_object' }
    // Several free models are reasoning models. Left unbounded, their thinking
    // eats max_tokens and the response comes back empty (finish_reason
    // "length"). Budget it explicitly; 0 means "do not think".
    if (this.config.reasoningMaxTokens >= 0) {
      body.reasoning = { max_tokens: this.config.reasoningMaxTokens }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    // Attribution headers are required by OpenRouter's free-tier terms and
    // cost nothing. Never send the key anywhere but the Authorization header.
    headers['Authorization'] = `Bearer ${this.config.apiKey}`
    if (this.config.appUrl) headers['HTTP-Referer'] = this.config.appUrl
    if (this.config.appTitle) headers['X-Title'] = this.config.appTitle

    let lastFailure: { success: false; code: OpenRouterErrorCode; retryable: boolean; error: Error } | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await axios.post<OpenRouterChatResponse>(
          `${this.config.baseUrl}/chat/completions`,
          body,
          { headers, timeout: this.config.timeoutMs }
        )
        return { success: true, response: response.data }
      } catch (err) {
        const axiosErr = err as AxiosError
        const { code, retryable } = classify(axiosErr)

        // Provider messages can echo the request; never surface or log them raw.
        const safe = new Error(`OpenRouter ${code.replace(/_/g, ' ')}`)

        if (!retryable || attempt === this.config.maxRetries) {
          return { success: false, error: safe, code, retryable }
        }
        lastFailure = { success: false, code, retryable, error: safe }
        await sleep(retryDelayMs(axiosErr, attempt, this.config.retryBaseMs))
      }
    }

    /* c8 ignore next */
    return (
      lastFailure ?? {
        success: false,
        error: new Error('OpenRouter request failed'),
        code: 'network',
        retryable: true,
      }
    )
  }
}

export interface FreeModelInfo {
  id: string
  contextLength: number
  supportsJsonMode: boolean
}

/**
 * Fetch the live model catalog and report which ids are free. Costs nothing —
 * GET /models is not a completion and is not quota-bound. Used by
 * /api/plan/ai/status so a dead model id is visible before it 400s in prod.
 */
export async function listFreeModels(
  config: Pick<OpenRouterConfig, 'baseUrl' | 'apiKey' | 'timeoutMs'>
): Promise<FreeModelInfo[]> {
  const res = await axios.get<{ data: Array<Record<string, any>> }>(
    `${config.baseUrl}/models`,
    {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      timeout: config.timeoutMs,
    }
  )
  return (res.data?.data ?? [])
    .filter(m => m?.id?.endsWith(':free') && Number(m?.pricing?.prompt) === 0)
    .map(m => ({
      id: m.id,
      contextLength: Number(m?.context_length) || 0,
      supportsJsonMode: (m?.supported_parameters ?? []).includes('response_format'),
    }))
}
