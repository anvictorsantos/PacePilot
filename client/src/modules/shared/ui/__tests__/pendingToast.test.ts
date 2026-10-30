import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  consumePendingToast,
  queuePendingToast,
  type PendingToast,
} from '@/modules/shared/ui/pendingToast.ts'
import { ToastPosition, ToastType } from '@/modules/shared/ui/useToast.ts'

/** Minimal sessionStorage stand-in: vitest runs this suite in the node
 *  environment, where the browser API does not exist. */
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  }
}

const original = (globalThis as { sessionStorage?: Storage }).sessionStorage

beforeEach(() => {
  ;(globalThis as { sessionStorage?: Storage }).sessionStorage = fakeStorage()
})

afterEach(() => {
  if (original) (globalThis as { sessionStorage?: Storage }).sessionStorage = original
  else delete (globalThis as { sessionStorage?: Storage }).sessionStorage
})

describe('pending toast', () => {
  it('round-trips a toast across a reload and consumes it exactly once', () => {
    const toast: PendingToast = {
      type: ToastType.Success,
      message: 'Strava disconnected. Your account is still active.',
    }
    queuePendingToast(toast)

    expect(consumePendingToast()).toEqual(toast)
    expect(consumePendingToast()).toBeNull()
  })

  it('keeps the position when one was chosen', () => {
    queuePendingToast({ type: ToastType.Error, message: 'nope', position: ToastPosition.TopCenter })
    expect(consumePendingToast()).toEqual({
      type: ToastType.Error,
      message: 'nope',
      position: ToastPosition.TopCenter,
    })
  })

  it('drops a payload it did not write', () => {
    sessionStorage.setItem('pacepilot.pending-toast', '{"message":"hi","type":"explosion"}')
    expect(consumePendingToast()).toBeNull()
    expect(sessionStorage.getItem('pacepilot.pending-toast')).toBeNull()
  })

  it('drops malformed JSON and an empty message', () => {
    sessionStorage.setItem('pacepilot.pending-toast', '{not json')
    expect(consumePendingToast()).toBeNull()

    sessionStorage.setItem(
      'pacepilot.pending-toast',
      JSON.stringify({ type: ToastType.Info, message: '' }),
    )
    expect(consumePendingToast()).toBeNull()
  })

  it('is a no-op when storage is unavailable', () => {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage
    expect(() => queuePendingToast({ type: ToastType.Info, message: 'x' })).not.toThrow()
    expect(consumePendingToast()).toBeNull()
  })
})
