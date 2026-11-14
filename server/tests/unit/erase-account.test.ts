import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'

import {
  eraseAccount,
  type EraseAccountDeps,
} from '@/modules/athlete/application/erase-account.service.ts'

function deps(calls: string[], cleared: string[]): EraseAccountDeps {
  const erase = (name: string, count: number) => async (_id: unknown, sessionArg?: unknown) => {
    calls.push(`${name}:${sessionArg ? 'txn' : 'no-txn'}`)
    return count
  }
  return {
    activities: erase('activity', 2),
    feedbacks: erase('feedback', 1),
    connections: erase('connection', 1),
    cursors: erase('cursor', 1),
    athlete: erase('athlete', 1),
    clearCache: (id) => cleared.push(id),
  }
}

test('erasure empties every collection keyed by the athlete', async () => {
  const calls: string[] = []
  const cleared: string[] = []
  const deleted = await eraseAccount('abc', undefined, deps(calls, cleared))

  // A provider grant or the import cursor left behind is still the athlete's data.
  assert.deepEqual(calls.sort(), [
    'activity:no-txn',
    'athlete:no-txn',
    'connection:no-txn',
    'cursor:no-txn',
    'feedback:no-txn',
  ])
  assert.equal(deleted, 6)
  assert.deepEqual(cleared, ['abc'])
})

test('a transaction session reaches every delete', async () => {
  const calls: string[] = []
  const cleared: string[] = []
  await eraseAccount('abc', {} as mongoose.ClientSession, deps(calls, cleared))

  assert.ok(calls.length > 0)
  assert.ok(calls.every((call) => call.endsWith(':txn')))
})
