// OpenRouter — server-side only, never checked into client bundles.
import axios, { AxiosError } from 'axios'

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_TIMEOUT_MS = 20000

export interface OpenRouterConfig {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  enabled: boolean
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

export interface OpenRouterErrorResponse {
  error: {
    message: string
    type: string
    code: string
    statusCode: number
  }
}

export interface OpenRouterChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: OpenRouterChoice[]
  usage: OpenRouterUsage
}

export interface OpenRouterResult {
  success: true
  response: OpenRouterChatResponse
} | {
  success: false
  error: Error
}

export class OpenRouterClient {
  private config: OpenRouterConfig

  constructor(config: OpenRouterConfig) {
    this.config = config
  }

  async chat(messages: OpenRouterMessage[]): Promise<OpenRouterResult> {
    if (!this.config.enabled || !this.config.apiKey) {
      return { success: false, error: new Error('OpenRouter disabled or no API key configured') }
    }

    try {
      const response = await axios.post<OpenRouterChatResponse>(
        `${this.config.baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages,
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.config.timeoutMs,
        }
      )

      return { success: true, response }
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: { message: string } }>

      if (axiosErr.code === 'ECONNABORTED') {
        return { success: false, error: new Error('OpenRouter request timed out') }
      }

      if (axiosErr.response?.status === 429) {
        return { success: false, error: new Error('OpenRouter rate limit exceeded') }
      }

      if (axiosErr.response?.status === 401) {
        return { success: false, error: new Error('OpenRouter authentication failed — check API key') }
      }

      if (axiosErr.response?.status === 400) {
        return { success: false, error: new Error('OpenRouter bad request — check model ID and payload') }
      }

      if (axiosErr.response?.status >= 500) {
        const msg = axiosErr.response?.data?.error?.message || 'OpenRouter server error'
        return { success: false, error: new Error(`OpenRouter server error: ${msg}`) }
      }

      return { success: false, error: new Error(`OpenRouter error: ${axiosErr.message}`) }
    }
  }
}