import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  FRESHNESS_WINDOW_MS,
  expiryFromStored,
  isExpiryCorrupted,
  isTokenFresh,
} from '@/modules/providers/domain/tokenExpiry.ts'

// 2024-10-04T00:00:00Z — a Strava-style expiry in epoch seconds.
const EXPIRY_SECONDS = 1_728_000_000
const EXPIRY_DATE = new Date(EXPIRY_SECONDS * 1000)
const NOW = Date.parse('2024-10-03T12:00:00Z')

describe('expiryFromStored', () => {
  test('reads legacy epoch seconds as a real expiry, not 1970', () => {
    assert.deepEqual(expiryFromStored(EXPIRY_SECONDS), EXPIRY_DATE)
  })

  test('repairs a date that was written from epoch seconds', () => {
    // The migrated value: seconds cast into a date-typed field → 1970-01-21.
    const corrupted = new Date(EXPIRY_SECONDS)
    assert.equal(corrupted.toISOString().slice(0, 4), '1970')
    assert.deepEqual(expiryFromStored(corrupted), EXPIRY_DATE)
  })

  test('leaves a real Date and epoch milliseconds untouched', () => {
    assert.deepEqual(expiryFromStored(EXPIRY_DATE), EXPIRY_DATE)
    assert.deepEqual(expiryFromStored(EXPIRY_DATE.getTime()), EXPIRY_DATE)
  })

  test('accepts the ISO string a lean document can carry', () => {
    assert.deepEqual(expiryFromStored(EXPIRY_DATE.toISOString()), EXPIRY_DATE)
  })

  test('returns null when there is no expiry', () => {
    assert.equal(expiryFromStored(null), null)
    assert.equal(expiryFromStored(undefined), null)
    assert.equal(expiryFromStored(''), null)
    assert.equal(expiryFromStored(Number.NaN), null)
    assert.equal(expiryFromStored('not-a-date'), null)
  })
})

describe('isExpiryCorrupted', () => {
  test('flags a date that came from epoch seconds', () => {
    assert.equal(isExpiryCorrupted(new Date(EXPIRY_SECONDS)), true)
  })

  test('does not flag a value already in the right unit', () => {
    assert.equal(isExpiryCorrupted(EXPIRY_DATE), false)
    assert.equal(isExpiryCorrupted(EXPIRY_SECONDS), false)
    assert.equal(isExpiryCorrupted(EXPIRY_DATE.getTime()), false)
    assert.equal(isExpiryCorrupted(null), false)
  })
})

describe('isTokenFresh', () => {
  test('a token more than a minute from expiry is fresh', () => {
    assert.equal(isTokenFresh(new Date(NOW + FRESHNESS_WINDOW_MS + 1000), NOW), true)
  })

  test('a token within a minute of expiry is not fresh', () => {
    assert.equal(isTokenFresh(new Date(NOW + 30_000), NOW), false)
    assert.equal(isTokenFresh(new Date(NOW + FRESHNESS_WINDOW_MS), NOW), false)
  })

  test('an expired or missing token is not fresh', () => {
    assert.equal(isTokenFresh(new Date(NOW - 1), NOW), false)
    assert.equal(isTokenFresh(null, NOW), false)
  })

  test('a corrected 1970 expiry is stale, so the token is refreshed once, not forever', () => {
    assert.equal(isTokenFresh(new Date(EXPIRY_SECONDS), NOW + 1000), true)
    assert.equal(isTokenFresh(new Date(EXPIRY_SECONDS), Date.parse('2024-10-05T00:00:00Z')), false)
  })
})
