/**
 * Provider-boundary failures. Routes map these to HTTP; nothing downstream
 * inspects axios or a provider's error body.
 */
export class ProviderError extends Error {
  readonly status: number
  readonly provider: string
  readonly code: string
  /** The provider's own HTTP status when the failure came from one, else null. */
  readonly upstreamStatus: number | null

  constructor(
    message: string,
    {
      status = 502,
      provider = 'unknown',
      code = 'provider_error',
      upstreamStatus = null,
    }: {
      status?: number
      provider?: string
      code?: string
      upstreamStatus?: number | null
    } = {},
  ) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
    this.provider = provider
    this.code = code
    this.upstreamStatus = upstreamStatus
  }
}

/** The provider answered 429. `retryAfter` is seconds when the provider said so. */
export class ProviderRateLimitError extends ProviderError {
  readonly retryAfter: number

  constructor(provider: string, retryAfter: unknown) {
    const seconds = Number(retryAfter)
    super(`${provider} rate limited — retry after ${Number.isFinite(seconds) ? seconds : 60}s`, {
      status: 429,
      provider,
      code: 'rate_limited',
      upstreamStatus: 429,
    })
    this.name = 'ProviderRateLimitError'
    this.retryAfter = Number.isFinite(seconds) ? seconds : 60
  }
}

/** No usable credential: the athlete must connect the provider again. */
export class ProviderAuthError extends ProviderError {
  constructor(provider: string, message = `No ${provider} credentials`) {
    super(message, { status: 401, provider, code: 'not_connected', upstreamStatus: 401 })
    this.name = 'ProviderAuthError'
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError
}
