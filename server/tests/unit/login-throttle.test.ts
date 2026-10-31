import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BASE_LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  MAX_LOCK_MINUTES,
  isLocked,
  lockDurationMinutes,
} from '@/modules/auth/domain/login-throttle.ts'

test('no lock below the failure threshold', () => {
  for (let count = 0; count < MAX_FAILED_LOGINS; count += 1) {
    assert.equal(lockDurationMinutes(count), 0)
  }
})

test('lock doubles from the threshold and caps out', () => {
  assert.equal(lockDurationMinutes(MAX_FAILED_LOGINS), BASE_LOCK_MINUTES)
  assert.equal(lockDurationMinutes(MAX_FAILED_LOGINS + 1), BASE_LOCK_MINUTES * 2)
  assert.equal(lockDurationMinutes(MAX_FAILED_LOGINS + 10), MAX_LOCK_MINUTES)
})

test('isLocked compares against now and tolerates bad input', () => {
  const now = new Date('2026-10-31T12:00:00Z')
  assert.equal(isLocked(new Date('2026-10-31T12:15:00Z'), now), true)
  assert.equal(isLocked(new Date('2026-10-31T11:45:00Z'), now), false)
  assert.equal(isLocked(undefined, now), false)
  assert.equal(isLocked('not-a-date', now), false)
})
