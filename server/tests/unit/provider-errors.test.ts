import test, { describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

const axios = (await import('axios')).default
const { createStravaProvider } = await import(
  '@/modules/providers/infrastructure/providers/strava/StravaProvider.ts'
)

/**
 * The adapter sits on the provider boundary: what it throws decides whether a
 * route says "activity gone" or "Strava refused us". Only a real 404 is the
 * former; anything else must reach the caller with the upstream status intact.
 */
const strava = createStravaProvider({
  clientId: '123',
  clientSecret: 'secret',
  redirectUri: 'https://app.test/api/providers/strava/callback',
})

const realGet = axios.get

function failWith(status: number): void {
  axios.get = (async () => {
    throw { isAxiosError: true, message: `upstream ${status}`, response: { status, headers: {} } }
  }) as typeof axios.get
}

afterEach(() => {
  axios.get = realGet
})

describe('provider error boundary', () => {
  test('a 404 means the activity is gone', async () => {
    failWith(404)
    assert.equal(await strava.getActivity('token', '9001'), null)
  })

  test('a 403 is a permission failure, not a missing activity', async () => {
    failWith(403)
    await assert.rejects(
      () => strava.getActivity('token', '9001'),
      (error: { status?: number; upstreamStatus?: number | null; code?: string }) =>
        error.code === 'upstream_error' &&
        error.status === 400 &&
        error.upstreamStatus === 403,
    )
  })

  test('a 500 is an upstream failure the client is told to retry', async () => {
    failWith(503)
    await assert.rejects(
      () => strava.getActivity('token', '9001'),
      (error: { status?: number; upstreamStatus?: number | null }) =>
        error.status === 502 && error.upstreamStatus === 503,
    )
  })
})
