import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/vue', () => ({
  captureException: vi.fn(() => 'event-id'),
  captureMessage: vi.fn(() => 'message-id'),
  setTags: vi.fn(),
}))

import * as Sentry from '@sentry/vue'
import { captureException, captureMessage } from '@/services/logger.ts'

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('captures an exception once', () => {
    const error = new Error('boom')
    const first = captureException(error, { feature: 'test' })
    const second = captureException(error, { feature: 'test' })
    expect(first).toBe('event-id')
    expect(second).toBeUndefined()
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledTimes(1)
  })

  it('captures a message', () => {
    captureMessage('hello', { operation: 'test' })
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledOnce()
  })
})
