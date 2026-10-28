import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  BACKFILL_PER_PAGE,
  advanceBackfill,
  beginBackfillStep,
  failBackfill,
  isBackfillRunnable,
  nextBackfillRequest,
  pauseBackfill,
  planBackfillStart,
} from '@/modules/providers/domain/backfill.ts'

/**
 * The historical import is a cursor, not a loop: the rules below are what keeps
 * it bounded (a floor and a page budget per step) and resumable (the cursor is
 * the only in-flight state). Everything here is pure, so a stopped run costs
 * one assertion rather than a database.
 */

const NOW = new Date('2026-05-01T00:00:00.000Z')

function page(startedAts: string[]) {
  return { fetched: startedAts.length, oldest: oldestOf(startedAts) }
}

function oldestOf(startedAts: string[]): Date | null {
  if (!startedAts.length) return null
  return startedAts.reduce<Date>((oldest, value) => {
    const at = new Date(value)
    return at < oldest ? at : oldest
  }, new Date(startedAts[0]))
}

describe('backfill start', () => {
  test('starts below the oldest activity we already hold', () => {
    const state = planBackfillStart({
      now: NOW,
      oldestActivityAt: new Date('2026-04-20T08:00:00.000Z'),
      windowDays: 90,
    })
    assert.equal(state.status, 'pending')
    assert.deepEqual(state.cursorBefore, new Date('2026-04-20T08:00:00.000Z'))
    assert.deepEqual(state.floor, new Date('2026-01-31T00:00:00.000Z'))
    assert.equal(state.pagesDone, 0)
    assert.equal(state.imported, 0)
  })

  test('never asks the provider for a range the retention policy will delete', () => {
    const state = planBackfillStart({
      now: NOW,
      oldestActivityAt: new Date('2026-01-01T00:00:00.000Z'),
      windowDays: 10,
    })
    assert.equal(state.status, 'complete')
    assert.equal(nextBackfillRequest(state), null)
  })

  test('an account with no activities yet starts its cursor at now', () => {
    const state = planBackfillStart({
      now: NOW,
      oldestActivityAt: null,
      windowDays: 10,
    })
    assert.deepEqual(state.cursorBefore, NOW)
    assert.deepEqual(state.floor, new Date('2026-04-21T00:00:00.000Z'))
    assert.deepEqual(nextBackfillRequest(state), { before: NOW, perPage: BACKFILL_PER_PAGE })
  })
})

describe('backfill cursor', () => {
  test('each page moves the cursor below the oldest row it returned', () => {
    const state = planBackfillStart({
      now: NOW,
      oldestActivityAt: new Date('2026-04-20T00:00:00.000Z'),
      windowDays: 90,
    })
    const running = beginBackfillStep(state, NOW)
    const next = advanceBackfill(running, { ...page(['2026-04-19T07:00:00.000Z', '2026-04-18T07:00:00.000Z']), now: NOW })

    assert.equal(next.status, 'running')
    assert.equal(next.pagesDone, 1)
    // Exclusive upper bound: the oldest row already stored is never fetched twice.
    assert.deepEqual(next.cursorBefore, new Date('2026-04-18T06:59:59.000Z'))
  })

  test('an empty page means the history is exhausted', () => {
    const running = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: NOW, windowDays: 90 }),
      NOW,
    )
    const done = advanceBackfill(running, { fetched: 0, oldest: null, now: NOW })
    assert.equal(done.status, 'complete')
    assert.equal(nextBackfillRequest(done), null)
  })

  test('stops at the floor instead of walking past retention', () => {
    const running = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: new Date('2026-04-30T00:00:00.000Z'), windowDays: 10 }),
      NOW,
    )
    const done = advanceBackfill(running, {
      fetched: 50,
      oldest: new Date('2026-04-01T00:00:00.000Z'),
      now: NOW,
    })
    assert.equal(done.status, 'complete')
  })

  test('a page that does not move backwards still advances the cursor', () => {    const cursor = new Date('2026-04-20T00:00:00.000Z')
    const running = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: cursor, windowDays: 90 }),
      NOW,
    )
    // A provider that ignores `before` would otherwise loop forever on page one.
    const next = advanceBackfill(running, { fetched: 50, oldest: new Date('2026-04-25T00:00:00.000Z'), now: NOW })
    const cursorBefore = next.cursorBefore
    assert.ok(cursorBefore)
    assert.ok(cursorBefore.getTime() < cursor.getTime())
    assert.deepEqual(cursorBefore, new Date(cursor.getTime() - 1000))
  })

  test('a short page ends the walk without spending another request', () => {
    const running = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: new Date('2026-04-30T00:00:00.000Z'), windowDays: 90 }),
      NOW,
    )
    // Fewer rows than a full page: nothing older exists, even though the floor
    // was not reached. Fetching again would be an avoidable provider call.
    const done = advanceBackfill(running, {
      fetched: 12,
      oldest: new Date('2026-04-25T00:00:00.000Z'),
      exhausted: true,
      now: NOW,
    })
    assert.equal(done.status, 'complete')
  })

  test('the page budget pauses the step with the cursor intact', () => {
    let state = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: new Date('2026-04-30T00:00:00.000Z'), windowDays: 90 }),
      NOW,
    )
    for (let i = 0; i < 3; i++) {
      const cursor = state.cursorBefore
      assert.ok(cursor)
      state = advanceBackfill(state, {
        fetched: 50,
        oldest: new Date(cursor.getTime() - 86400000),
        now: NOW,
      })
    }
    assert.equal(state.status, 'paused')
    assert.equal(state.pagesDone, 3)
    // Paused, not reset: the next request resumes exactly where this one stopped.
    assert.deepEqual(nextBackfillRequest(beginBackfillStep(state, NOW))?.before, state.cursorBefore)
  })
})

describe('backfill interruption', () => {
  test('a manual sync pauses a running step and the cursor survives', () => {
    const running = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: new Date('2026-04-30T00:00:00.000Z'), windowDays: 90 }),
      NOW,
    )
    const paused = pauseBackfill(running, NOW)
    assert.equal(paused.status, 'paused')
    assert.deepEqual(paused.cursorBefore, running.cursorBefore)
    assert.equal(nextBackfillRequest(paused)?.before.toString(), running.cursorBefore?.toString())
  })

  test('only a runnable state starts a step, and a recently claimed one is not stolen', () => {
    const running = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: NOW, windowDays: 90 }),
      NOW,
    )
    assert.equal(isBackfillRunnable(running, new Date(NOW.getTime() + 5_000)), false)
    // A step whose owner died must not wedge the cursor forever.
    assert.equal(isBackfillRunnable(running, new Date(NOW.getTime() + 10 * 60 * 1000)), true)
    assert.equal(isBackfillRunnable(pauseBackfill(running, NOW), NOW), true)
    assert.equal(isBackfillRunnable({ ...running, status: 'complete' }, NOW), false)
    assert.equal(isBackfillRunnable({ ...running, status: 'idle' }, NOW), false)
  })

  test('a rate-limited step is resumable once the provider says so', () => {
    const running = beginBackfillStep(
      planBackfillStart({ now: NOW, oldestActivityAt: NOW, windowDays: 90 }),
      NOW,
    )
    const failed = failBackfill(running, { code: 'rate_limited', retryAfter: 60, now: NOW })
    assert.equal(failed.status, 'failed')
    assert.deepEqual(failed.error, { code: 'rate_limited', at: NOW, retryAfter: 60 })
    assert.equal(nextBackfillRequest(failed)?.before, running.cursorBefore)
    const resumed = beginBackfillStep(failed, NOW)
    assert.equal(resumed.status, 'running')
    assert.equal(resumed.error, null)
  })

  test('re-running a completed backfill is a no-op', () => {
    const complete = advanceBackfill(
      beginBackfillStep(planBackfillStart({ now: NOW, oldestActivityAt: NOW, windowDays: 90 }), NOW),
      { fetched: 0, oldest: null, now: NOW },
    )
    const again = beginBackfillStep(complete, NOW)
    assert.equal(again.status, 'complete')
    assert.equal(again.pagesDone, complete.pagesDone)
    assert.equal(nextBackfillRequest(again), null)
  })
})
