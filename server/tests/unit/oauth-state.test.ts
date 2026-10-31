import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidOAuthState,
  oauthStateCookie,
} from '@/modules/providers/application/oauth-state.ts'

describe('OAuth state', () => {
  test('accepts the raw state the provider echoes back', () => {
    const cookie = oauthStateCookie('strava', 'abc123')
    assert.equal(cookie, 'strava:abc123')
    assert.equal(isValidOAuthState('strava', 'abc123', cookie), true)
  })

  test('rejects the namespaced cookie value as the query state', () => {
    // Regression: comparing the raw query state with the `provider:state` cookie
    // failed every real authorization.
    assert.equal(isValidOAuthState('strava', 'strava:abc123', 'strava:abc123'), false)
  })

  test('rejects a state minted for another provider', () => {
    assert.equal(isValidOAuthState('garmin', 'abc123', oauthStateCookie('strava', 'abc123')), false)
  })

  test('rejects missing values', () => {
    assert.equal(isValidOAuthState('strava', undefined, 'strava:abc'), false)
    assert.equal(isValidOAuthState('strava', '', 'strava:'), false)
    assert.equal(isValidOAuthState('strava', 'abc', undefined), false)
  })
})
