/**
 * The data-access module is the seam every read crosses, so it is tested where
 * callers stand: through `api.*`, against a stubbed transport. The seven
 * per-service test files this replaces only asserted that a mock had been called
 * with a path literal — they never exercised the unwrap convention, the fallbacks
 * or the error classification, which is the behaviour that actually varies.
 */
import * as Sentry from '@sentry/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, apiErrorMessage, http } from '@/modules/shared/infrastructure/http/client.ts'

vi.mock('@sentry/vue', () => ({
  captureException: vi.fn(() => 'event-id'),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setTags: vi.fn(),
}))

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

describe('data-access module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    await api.strava.status()
    await api.activities.get(7)
    await api.goals.get()
    await api.account.current()

    expect(seen).toEqual([
      'GET /plan/week',
      'GET /plan/today',
      'GET /plan/feedback',
      'GET /progress',
      'GET /strava/status',
      'GET /activities/7',
      'GET /goals',
      'GET /me',
    ])
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

  it('reports a 5xx to Sentry and still rejects for the caller', async () => {
    fail(503)
    await expect(api.plan.week()).rejects.toThrow()
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledTimes(1)
    const [, context] = vi.mocked(Sentry.captureException).mock.calls[0] ?? []
    expect(context).toMatchObject({
      tags: { feature: 'http-client', operation: 'GET /plan/week' },
      extra: { feature: 'http-client', operation: 'GET /plan/week', status: 503 },
    })
  })

  it('reports an offline request', async () => {
    failOffline()
    await expect(api.progress.summary()).rejects.toThrow()
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledTimes(1)
  })

  it('leaves a 4xx to the caller without reporting it', async () => {
    fail(422, { error: 'rpe must be 1–10' })
    await expect(api.plan.submitFeedback({ rpe: 99 })).rejects.toThrow()
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })

  it('resolves void routes without unwrapping a body', async () => {
    respond(undefined, 204)
    await expect(api.account.delete()).resolves.toBeUndefined()
    await expect(api.strava.disconnect()).resolves.toBeUndefined()
  })
})

describe('apiErrorMessage', () => {
  it("prefers the server's own error copy", async () => {
    fail(429, { error: 'Strava rate limit reached' })
    const error = await api.strava.sync().catch((e) => e)
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
