import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import { Provider } from '@/modules/providers/domain/Provider.ts'
import { createStravaProvider, mapZones } from '@/modules/providers/infrastructure/providers/strava/StravaProvider.ts'

const strava = createStravaProvider({
  clientId: '123',
  clientSecret: 'secret',
  redirectUri: 'https://app.test/api/providers/strava/callback',
})

describe('provider contract — Strava', () => {
  test('declares its capabilities instead of the app assuming them', () => {
    assert.equal(strava.id, Provider.Strava)
    assert.equal(strava.capabilities.pull, true)
    assert.equal(strava.capabilities.webhook, false)
    assert.equal(strava.capabilities.streams, true)
    assert.equal(strava.capabilities.zones, true)
  })

  test('builds an authorize URL from config, not globals', () => {
    const url = new URL(strava.authorizeUrl('state-1', { mobile: true }))
    assert.equal(url.host, 'www.strava.com')
    assert.match(url.pathname, /mobile\/authorize$/)
    assert.equal(url.searchParams.get('client_id'), '123')
    assert.equal(url.searchParams.get('state'), 'state-1')
    assert.equal(url.searchParams.get('scope'), 'activity:read,profile:read_all')
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://app.test/api/providers/strava/callback',
    )
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
