/**
 * The data-access module is the seam every read crosses, so it is tested where
 * callers stand: through `api.*`, against a stubbed transport. The seven
 * per-service test files this replaces only asserted that a mock had been called
 * with a path literal — they never exercised the unwrap convention, the fallbacks
 * or the error classification, which is the behaviour that actually varies.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, apiErrorMessage, http } from '@/modules/shared/infrastructure/http/client.ts'
import { setObservabilitySink } from '@/modules/shared/infrastructure/observability/logger.ts'
import type { ObservabilitySink } from '@/modules/shared/infrastructure/observability/logger.ts'

const sink = {
  captureException: vi.fn<ObservabilitySink['captureException']>(() => 'event-id'),
  captureMessage: vi.fn<ObservabilitySink['captureMessage']>(() => 'message-id'),
  addBreadcrumb: vi.fn<ObservabilitySink['addBreadcrumb']>(),
}

const defaultAdapter = http.defaults.adapter

/** Answer the next request with `body`, or reject it with a shaped error. */
function respond(body: unknown, status = 200) {
  http.defaults.adapter = async (config) => ({
    data: body,
    status,
    statusText: 'OK',
    headers: {},
    config,
  })
}

function fail(status: number, body: unknown = {}) {
  http.defaults.adapter = async (config) => {
    const error = Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      config,
      response: { data: body, status, statusText: 'ERR', headers: {}, config },
    })
    return Promise.reject(error)
  }
}

function failOffline() {
  http.defaults.adapter = async (config) => {
    const error = Object.assign(new Error('Network Error'), { isAxiosError: true, config })
    return Promise.reject(error)
  }
}

function failCancelled() {
  http.defaults.adapter = async (config) => {
    const error = Object.assign(new Error('Request aborted'), {
      isAxiosError: true,
      config,
      code: 'ECONNABORTED',
    })
    return Promise.reject(error)
  }
}

describe('data-access module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setObservabilitySink(sink)
    respond({})
  })

  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
  })

  it('reads each route from one path registry', async () => {
    const seen: string[] = []
    http.defaults.adapter = async (config) => {
      seen.push(`${config.method?.toUpperCase()} ${config.url}`)
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await api.plan.week()
    await api.plan.today()
    await api.plan.feedback()
    await api.progress.summary()
    await api.providers.status()
    await api.activities.get(7)
    await api.goals.get()
    await api.account.current()

    expect(seen).toEqual([
      'GET /plan/week',
      'GET /plan/today',
      'GET /plan/feedback',
      'GET /progress',
      'GET /providers/status',
      'GET /activities/7',
      'GET /goals',
      'GET /me',
    ])
  })

  it('separates session logout from the real provider disconnect', async () => {
    const seen: string[] = []
    http.defaults.adapter = async (config) => {
      seen.push(`${config.method?.toUpperCase()} ${config.url}`)
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await api.auth.logout()
    await api.providers.disconnect('strava')

    expect(seen).toEqual(['POST /auth/logout', 'POST /providers/strava/disconnect'])
  })

  it('passes query params through instead of building URLs at call sites', async () => {
    let params: unknown
    http.defaults.adapter = async (config) => {
      params = config.params
      return { data: { items: [] }, status: 200, statusText: 'OK', headers: {}, config }
    }

    await api.activities.list({ page: 2, perPage: 9, type: 'tempo' })

    expect(params).toEqual({ page: 2, perPage: 9, type: 'tempo' })
  })

  it('asks for AI prose in the active locale', async () => {
    let params: unknown
    http.defaults.adapter = async (config) => {
      params = config.params
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await api.plan.aiWeek('pt')
    expect(params).toEqual({ locale: 'pt' })

    await api.plan.aiWeek('en')
    expect(params).toEqual({ locale: 'en' })
  })

  it('falls back to an empty object when a collection route sends no body', async () => {
    respond(undefined)
    await expect(api.activities.list()).resolves.toEqual({})
  })

  it('falls back to null when a single-resource route sends no body', async () => {
    respond(undefined)
    await expect(api.activities.get(1)).resolves.toBeNull()
    await expect(api.goals.get()).resolves.toBeNull()
  })

  it('unwraps the current user out of its envelope', async () => {
    respond({ user: { firstname: 'Ana' } })
    await expect(api.account.current()).resolves.toEqual({ firstname: 'Ana' })
  })

  it('returns null for a missing current user rather than throwing', async () => {
    respond({})
    await expect(api.account.current()).resolves.toBeNull()
  })

  it('reports a 5xx to the error sink and still rejects for the caller', async () => {
    fail(503)
    await expect(api.plan.week()).rejects.toThrow()
    expect(sink.captureException).toHaveBeenCalledTimes(1)
    const [, options] = vi.mocked(sink.captureException).mock.calls[0] ?? []
    expect(options).toMatchObject({
      tags: { feature: 'http-client', operation: 'GET /plan/week' },
      extra: { feature: 'http-client', operation: 'GET /plan/week', status: 503 },
    })
  })

  it('reports an offline request', async () => {
    failOffline()
    await expect(api.progress.summary()).rejects.toThrow()
    expect(sink.captureException).toHaveBeenCalledTimes(1)
  })

  it('records a cancelled request as a breadcrumb, not an error event', async () => {
    // The client aborted it: a route change, an unmount, a superseded read.
    failCancelled()
    await expect(api.activities.list()).rejects.toThrow()
    expect(sink.captureException).not.toHaveBeenCalled()
    expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1)
    const [breadcrumb] = vi.mocked(sink.addBreadcrumb).mock.calls[0] ?? []
    expect(breadcrumb).toMatchObject({
      category: 'recovered-error',
      level: 'warning',
      message: 'Request aborted',
      data: { feature: 'http-client', operation: 'GET /activities', code: 'ECONNABORTED' },
    })
  })

  it('still reports a 5xx that is not a cancellation', async () => {
    fail(503)
    await expect(api.activities.list()).rejects.toThrow()
    expect(sink.captureException).toHaveBeenCalledTimes(1)
    expect(sink.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('treats an offline session probe as a breadcrumb, not an error event', async () => {
    // The probe decides who is signed in. A phone that lost signal is not a
    // bug in the app, and the guard reads the rejection to say so.
    failOffline()
    await expect(api.auth.session()).rejects.toThrow()
    expect(sink.captureException).not.toHaveBeenCalled()
    expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1)
    const [breadcrumb] = vi.mocked(sink.addBreadcrumb).mock.calls[0] ?? []
    expect(breadcrumb).toMatchObject({
      category: 'recovered-error',
      level: 'warning',
      message: 'Network Error',
      data: { feature: 'http-client', operation: 'GET /auth/session' },
    })
  })

  it('still reports a server fault on the session probe', async () => {
    // Only a transport failure is recoverable: a 500 is still ours.
    fail(500)
    await expect(api.auth.session()).rejects.toThrow()
    expect(sink.captureException).toHaveBeenCalledTimes(1)
    expect(sink.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('treats an offline provider-status probe as a breadcrumb, not an error event', async () => {
    // A background read on the landing page and in the header: losing signal on
    // the way to it is normal, and the app retries rather than flipping to
    // "not connected".
    failOffline()
    await expect(api.providers.status()).rejects.toThrow()
    expect(sink.captureException).not.toHaveBeenCalled()
    expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1)
    const [breadcrumb] = vi.mocked(sink.addBreadcrumb).mock.calls[0] ?? []
    expect(breadcrumb).toMatchObject({
      category: 'recovered-error',
      data: { operation: 'GET /providers/status' },
    })
  })

  it('still reports a 503 from the provider-status probe', async () => {
    // A database that is down is our problem, not the athlete's network.
    fail(503)
    await expect(api.providers.status()).rejects.toThrow()
    expect(sink.captureException).toHaveBeenCalledTimes(1)
    expect(sink.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('leaves a 4xx to the caller without reporting it', async () => {
    fail(422, { error: 'rpe must be 1–10' })
    await expect(api.plan.submitFeedback({ rpe: 99 })).rejects.toThrow()
    expect(sink.captureException).not.toHaveBeenCalled()
  })

  it('resolves void routes without unwrapping a body', async () => {
    respond(undefined, 204)
    await expect(api.account.delete()).resolves.toBeUndefined()
    await expect(api.providers.disconnect('strava')).resolves.toBeUndefined()
  })
})

describe('apiErrorMessage', () => {
  it("prefers the server's own error copy", async () => {
    fail(429, { error: 'Strava rate limit reached' })
    const error = await api.providers.sync('strava').catch((e) => e)
    expect(apiErrorMessage(error, 'Sync failed')).toBe('Strava rate limit reached')
  })

  it('falls back to the localized message when the body carries none', async () => {
    fail(500, {})
    const error = await api.progress.summary().catch((e) => e)
    expect(apiErrorMessage(error, 'Could not load')).toBe('Could not load')
  })

  it('falls back for a non-axios failure', () => {
    expect(apiErrorMessage(new Error('boom'), 'Could not load')).toBe('Could not load')
    expect(apiErrorMessage(undefined, 'Could not load')).toBe('Could not load')
  })
})
