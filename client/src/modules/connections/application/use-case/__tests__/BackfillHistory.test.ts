import { describe, expect, it, vi } from 'vitest'

import { BackfillHistory } from '@/modules/connections/application/use-case/BackfillHistory.ts'
import type {
  BackfillProgress,
  BackfillRepository,
} from '@/modules/connections/domain/repository/backfill.repository.ts'
import { BackfillStatus } from '@/modules/connections/domain/value-object/BackfillStatus.ts'

function progress(overrides: Partial<BackfillProgress> = {}): BackfillProgress {
  return {
    status: BackfillStatus.Paused,
    imported: 0,
    skipped: 0,
    pagesDone: 1,
    hasMore: true,
    error: null,
    ...overrides,
  }
}

function setup(steps: Array<BackfillProgress | Error>, initial?: BackfillProgress) {
  const queue = [...steps]
  const repository: BackfillRepository = {
    status: vi.fn(async () => initial ?? progress()),
    step: vi.fn(async () => {
      const next = queue.shift()
      if (!next) throw new Error('step called more times than the test allows')
      if (next instanceof Error) throw next
      return next
    }),
    stop: vi.fn(async () => progress({ status: BackfillStatus.Paused, hasMore: true })),
  }
  const cache = { invalidateAfterImport: vi.fn() }
  const useCase = new BackfillHistory(repository, cache)
  return { repository, cache, useCase, queue }
}

describe('BackfillHistory', () => {
  it('walks the stored cursor until the retained window is covered', async () => {
    const { repository, cache, useCase } = setup([
      progress({ imported: 50 }),
      progress({ imported: 62, status: BackfillStatus.Complete, hasMore: false }),
    ])

    const result = await useCase.run()

    expect(repository.step).toHaveBeenCalledTimes(2)
    expect(result.imported).toBe(62)
    expect(cache.invalidateAfterImport).toHaveBeenCalledOnce()
  })

  it('a finished walk asks the provider for nothing', async () => {
    const { repository, cache, useCase } = setup(
      [],
      progress({
        status: BackfillStatus.Complete,
        hasMore: false,
      }),
    )

    const result = await useCase.run()

    expect(repository.step).not.toHaveBeenCalled()
    expect(result.status).toBe(BackfillStatus.Complete)
    expect(cache.invalidateAfterImport).not.toHaveBeenCalled()
  })

  it('does not compete with a step another caller already holds', async () => {
    const { repository, useCase } = setup([
      progress({ status: BackfillStatus.Running, imported: 0 }),
    ])
    await useCase.run()
    expect(repository.step).toHaveBeenCalledTimes(1)
  })

  it('honours a stop between steps and leaves the cursor for the next run', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const repository: BackfillRepository = {
      status: vi.fn(async () => progress()),
      step: vi.fn(async () => {
        await gate
        return progress({ imported: 50 })
      }),
      stop: vi.fn(async () => progress({ status: BackfillStatus.Paused, hasMore: true })),
    }
    const cache = { invalidateAfterImport: vi.fn() }
    const useCase = new BackfillHistory(repository, cache)

    const walking = useCase.run()
    await vi.waitFor(() => expect(repository.step).toHaveBeenCalledTimes(1))
    await useCase.stop()
    release()
    await walking

    // The in-flight step finishes; no further request is made.
    expect(repository.step).toHaveBeenCalledTimes(1)
    expect(repository.stop).toHaveBeenCalledOnce()
  })

  it('surfaces a failure and stays resumable instead of claiming the range', async () => {
    const { repository, cache, useCase } = setup([new Error('rate limited')])

    await expect(useCase.run()).rejects.toThrow('rate limited')
    expect(cache.invalidateAfterImport).not.toHaveBeenCalled()
    // A second ask is allowed: the server kept the cursor.
    expect(repository.step).toHaveBeenCalledTimes(1)
  })

  it('shares one walk between the shell and Settings', async () => {
    const { repository, useCase } = setup([
      progress({ imported: 10, status: BackfillStatus.Complete, hasMore: false }),
    ])

    await Promise.all([useCase.run(), useCase.run()])

    expect(repository.step).toHaveBeenCalledTimes(1)
  })
})
