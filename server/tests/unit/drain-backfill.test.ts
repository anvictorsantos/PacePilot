import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import type { BackfillProgress } from '@/modules/providers/application/backfill.service.ts'
import { drainBackfill } from '@/modules/providers/application/drain-backfill.ts'

function progress(overrides: Partial<BackfillProgress> = {}): BackfillProgress {
  return {
    status: 'paused',
    imported: 0,
    skipped: 0,
    pagesDone: 1,
    hasMore: true,
    cursorBefore: null,
    floor: null,
    error: null,
    ...overrides,
  }
}

function sequence(steps: BackfillProgress[]): () => Promise<BackfillProgress> {
  let index = 0
  return async () => steps[Math.min(index++, steps.length - 1)]!
}

describe('drainBackfill', () => {
  test('continues while pages remain and stops when complete', async () => {
    const result = await drainBackfill(
      sequence([
        progress({ status: 'paused', hasMore: true }),
        progress({ status: 'running', hasMore: true }),
        progress({ status: 'complete', hasMore: false }),
      ]),
    )

    assert.equal(result.steps, 3)
    assert.equal(result.progress.status, 'complete')
    assert.equal(result.exhausted, true)
  })

  test('stops as soon as no pages remain', async () => {
    const result = await drainBackfill(sequence([progress({ status: 'paused', hasMore: false })]))

    assert.equal(result.steps, 1)
    assert.equal(result.exhausted, true)
  })

  test('stops on a failed cursor instead of spending more provider calls', async () => {
    const result = await drainBackfill(sequence([progress({ status: 'failed', hasMore: true })]))

    assert.equal(result.steps, 1)
    assert.equal(result.exhausted, true)
  })

  test('caps a run that keeps reporting more work', async () => {
    const result = await drainBackfill(async () => progress(), 3)

    assert.equal(result.steps, 3)
    assert.equal(result.exhausted, false)
  })
})
