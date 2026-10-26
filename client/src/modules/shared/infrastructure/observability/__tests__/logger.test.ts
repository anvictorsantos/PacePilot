import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  captureException,
  captureMessage,
  recordRecoveredError,
  setObservabilitySink,
} from '@/modules/shared/infrastructure/observability/logger.ts'

const sink = {
  captureException: vi.fn(() => 'event-id'),
  captureMessage: vi.fn(() => 'message-id'),
  addBreadcrumb: vi.fn(),
}

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setObservabilitySink(sink)
  })

  it('captures an exception once', () => {
    const error = new Error('boom')
    const first = captureException(error, { feature: 'test' })
    const second = captureException(error, { feature: 'test' })
    expect(first).toBe('event-id')
    expect(second).toBeUndefined()
    expect(sink.captureException).toHaveBeenCalledTimes(1)
  })

  it('captures a message', () => {
    captureMessage('hello', { operation: 'test' })
    expect(sink.captureMessage).toHaveBeenCalledOnce()
  })

  it('buffers events until the sink is attached', () => {
    setObservabilitySink(null)
    captureException(new Error('early'), { feature: 'bootstrap' })
    captureMessage('early message')
    recordRecoveredError(new Error('recovered'), { feature: 'bootstrap' })
    expect(sink.captureException).not.toHaveBeenCalled()

    setObservabilitySink(sink)
    expect(sink.captureException).toHaveBeenCalledOnce()
    expect(sink.captureMessage).toHaveBeenCalledOnce()
    expect(sink.addBreadcrumb).toHaveBeenCalledOnce()
  })

  it('reports how many events the buffer cap cost', () => {
    setObservabilitySink(null)
    for (let index = 0; index < 51; index += 1) {
      captureException(new Error(`early ${index}`))
    }

    setObservabilitySink(sink)
    expect(sink.captureException).toHaveBeenCalledTimes(50)
    expect(sink.captureMessage).toHaveBeenCalledWith(
      'Dropped 1 buffered events before the error sink attached',
      expect.objectContaining({ tags: { feature: 'observability', operation: 'buffer-overflow' } }),
    )
  })
})
