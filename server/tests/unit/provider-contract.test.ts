import test, { describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { Provider } from '@/modules/providers/domain/Provider.ts'
import { createStravaProvider, mapZones } from '@/modules/providers/infrastructure/providers/strava/StravaProvider.ts'

const axios = (await import('axios')).default

const strava = createStravaProvider({
  clientId: '123',
  clientSecret: 'secret',
  redirectUri: 'https://app.test/api/providers/strava/callback',
})

const realPost = axios.post
afterEach(() => {
  axios.post = realPost
})

describe('provider contract — Strava', () => {
  test('declares its capabilities instead of the app assuming them', () => {
    assert.equal(strava.id, Provider.Strava)
    assert.equal(strava.capabilities.pull, true)
    assert.equal(strava.capabilities.webhook, true)
    assert.equal(strava.capabilities.streams, true)
    assert.equal(strava.capabilities.zones, true)
  })

  test('builds an authorize URL from config, not globals', () => {
    const url = new URL(strava.authorizeUrl('state-1', { mobile: true }))
    assert.equal(url.host, 'www.strava.com')
    assert.match(url.pathname, /mobile\/authorize$/)
    assert.equal(url.searchParams.get('client_id'), '123')
    assert.equal(url.searchParams.get('state'), 'state-1')
    // `read` must ride along: without it Strava can grant only the profile
    // scope, and the activity endpoints answer 403.
    assert.equal(url.searchParams.get('scope'), 'read,activity:read,profile:read_all')
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://app.test/api/providers/strava/callback',
    )
  })

  test('rejects a grant that only has the read scope', async () => {
    axios.post = (async () => ({
      data: {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_at: 4_102_444_800,
        scope: 'read',
        athlete: { id: 1 },
      },
    })) as unknown as typeof axios.post

    await assert.rejects(
      () => strava.exchangeCode('code'),
      (error: { code?: string; message?: string }) =>
        error.code === 'not_connected' && /activity access/i.test(String(error.message)),
    )
  })

  test('a rejected refresh asks for a reconnect, not a retry', async () => {
    axios.post = (async () => {
      throw {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        config: { url: 'https://www.strava.com/oauth/token' },
        response: { status: 400, headers: {}, data: { message: 'Bad Request' } },
      }
    }) as unknown as typeof axios.post

    await assert.rejects(
      () => strava.refresh('stale-refresh-token'),
      (error: { code?: string; message?: string }) =>
        error.code === 'not_connected' && /session expired/i.test(String(error.message)),
    )
  })

  test('revokes through /oauth/revoke with HTTP Basic client credentials', async () => {
    // /oauth/revoke replaced /oauth/deauthorize (recommended since 1 Jun 2026,
    // the only endpoint from 1 Jun 2027). The credentials travel in the Basic
    // header, never in the body.
    const axios = (await import('axios')).default
    const originalPost = axios.post
    const calls: Array<{ url: string; body: unknown; config: Record<string, any> }> = []
    axios.post = (async (url: string, body: unknown, config: Record<string, any>) => {
      calls.push({ url, body, config })
      return { data: {} }
    }) as unknown as typeof axios.post

    try {
      await strava.revoke('access-token-1')
    } finally {
      axios.post = originalPost
    }

    assert.equal(calls.length, 1)
    const call = calls[0]
    assert.ok(call)
    assert.match(call.url, /\/oauth\/revoke$/)
    assert.match(String(call.body), /token=access-token-1/)
    assert.match(String(call.body), /token_type_hint=access_token/)
    assert.equal(call.config.auth.username, '123')
    assert.equal(call.config.auth.password, 'secret')
    assert.equal(call.config.headers['Content-Type'], 'application/x-www-form-urlencoded')
  })
})

describe('canonical zones', () => {
  test('translates Strava heart-rate zones into {min,max}', () => {
    assert.deepEqual(
      mapZones({ heart_rate: { zones: [{ min: 100, max: 130 }, { min: 131, max: 150 }] } }),
      [{ min: 100, max: 130 }, { min: 131, max: 150 }],
    )
  })

  test('translates the legacy array grouping', () => {
    assert.deepEqual(
      mapZones([{ type: 'heartrate', zones: [{ min: 90, max: 120 }] }]),
      [{ min: 90, max: 120 }],
    )
  })

  test('returns null rather than inventing bands', () => {
    assert.equal(mapZones(null), null)
    assert.equal(mapZones({}), null)
    assert.equal(mapZones({ heart_rate: { zones: [] } }), null)
  })
})
