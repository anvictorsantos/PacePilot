import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import { createStravaProvider } from '@/modules/providers/infrastructure/providers/strava/StravaProvider.ts'

/**
 * The Strava push subscription contract, at the adapter seam: the handshake the
 * provider calls once per environment, the event envelope it posts afterwards,
 * and the only authorisation it offers (the subscription id) are translated
 * here so the route never learns Strava's field names.
 */
const strava = createStravaProvider({
  clientId: '123',
  clientSecret: 'secret',
  redirectUri: 'https://app.test/api/providers/strava/callback',
  webhookVerifyToken: 'verify-me',
  webhookSubscriptionId: '314159',
})

const handshake = (over: Record<string, unknown> = {}) => ({
  'hub.mode': 'subscribe',
  'hub.verify_token': 'verify-me',
  'hub.challenge': 'challenge-1',
  ...over,
})

const event = (over: Record<string, unknown> = {}) => ({
  object_type: 'activity',
  object_id: 9001,
  aspect_type: 'create',
  owner_id: 4242,
  subscription_id: 314159,
  event_time: 1710000000,
  updates: {},
  ...over,
})

describe('webhook handshake', () => {
  test('echoes the challenge when mode and token match', () => {
    assert.deepEqual(strava.verifyWebhook?.(handshake()), {
      status: 'verified',
      challenge: 'challenge-1',
    })
  })

  test('rejects a wrong or truncated verify token', () => {
    assert.deepEqual(strava.verifyWebhook?.(handshake({ 'hub.verify_token': 'nope' })), {
      status: 'rejected',
    })
    assert.deepEqual(strava.verifyWebhook?.(handshake({ 'hub.verify_token': 'verify' })), {
      status: 'rejected',
    })
  })

  test('rejects a mode other than subscribe', () => {
    assert.deepEqual(strava.verifyWebhook?.(handshake({ 'hub.mode': 'unsubscribe' })), {
      status: 'rejected',
    })
  })

  test('rejects a missing challenge instead of inventing one', () => {
    assert.deepEqual(strava.verifyWebhook?.(handshake({ 'hub.challenge': '' })), {
      status: 'rejected',
    })
    const withoutChallenge = handshake()
    delete (withoutChallenge as Record<string, unknown>)['hub.challenge']
    assert.deepEqual(strava.verifyWebhook?.(withoutChallenge), { status: 'rejected' })
  })

  test('reports an unconfigured subscription instead of accepting any token', () => {
    const unconfigured = createStravaProvider({
      clientId: '123',
      clientSecret: 'secret',
      redirectUri: 'https://app.test/api/providers/strava/callback',
      webhookVerifyToken: '',
      webhookSubscriptionId: '',
    })
    assert.deepEqual(unconfigured.verifyWebhook?.(handshake()), { status: 'unconfigured' })
  })
})

describe('webhook event envelope', () => {
  test('translates a create into canonical terms', () => {
    const parsed = strava.parseWebhook?.(event())
    assert.ok(parsed)
    assert.equal(parsed.provider, 'strava')
    assert.equal(parsed.objectType, 'activity')
    assert.equal(parsed.aspect, 'create')
    assert.equal(parsed.externalActivityId, '9001')
    assert.equal(parsed.externalAthleteId, '4242')
    assert.equal(parsed.subscriptionId, '314159')
    assert.deepEqual(parsed.eventTime, new Date(1710000000 * 1000))
  })

  test('keeps an athlete event distinguishable from an activity one', () => {
    const parsed = strava.parseWebhook?.(event({ object_type: 'athlete', aspect_type: 'update' }))
    assert.equal(parsed?.objectType, 'athlete')
    assert.equal(parsed?.aspect, 'update')
  })

  test('maps an unknown aspect to other rather than failing the delivery', () => {
    assert.equal(strava.parseWebhook?.(event({ aspect_type: 'explode' }))?.aspect, 'other')
  })

  test('rejects a structurally invalid envelope', () => {
    assert.equal(strava.parseWebhook?.(null), null)
    assert.equal(strava.parseWebhook?.({ object_type: 'activity' }), null)
    assert.equal(strava.parseWebhook?.(event({ owner_id: 'x'.repeat(65) })), null)
  })
})

describe('webhook authorisation', () => {
  test('accepts only the delivery for the configured subscription', () => {
    const parsed = strava.parseWebhook?.(event())
    assert.ok(parsed)
    assert.equal(strava.authoriseWebhook?.(parsed), 'authorised')

    const foreign = strava.parseWebhook?.(event({ subscription_id: 999 }))
    assert.ok(foreign)
    assert.equal(strava.authoriseWebhook?.(foreign), 'rejected')
  })

  test('reports an unconfigured subscription instead of accepting an unauthenticated post', () => {
    const unconfigured = createStravaProvider({
      clientId: '123',
      clientSecret: 'secret',
      redirectUri: 'https://app.test/api/providers/strava/callback',
      webhookVerifyToken: '',
      webhookSubscriptionId: '',
    })
    const parsed = unconfigured.parseWebhook?.(event())
    assert.ok(parsed)
    assert.equal(unconfigured.authoriseWebhook?.(parsed), 'unconfigured')
  })

  test('rejects an envelope without a subscription id', () => {
    const parsed = strava.parseWebhook?.(event({ subscription_id: undefined }))
    assert.ok(parsed)
    assert.equal(strava.authoriseWebhook?.(parsed), 'rejected')
  })
})
