import { describe, expect, it, vi } from 'vitest'

import {
  isChunkLoadError,
  onModulePreloadError,
  reloadOnce,
  type ReloadDeps,
} from '@/modules/shared/infrastructure/router/chunk-recovery.ts'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

function deps(overrides: Partial<ReloadDeps> = {}): ReloadDeps {
  return {
    storage: memoryStorage(),
    reload: vi.fn(),
    now: () => 1_000,
    ...overrides,
  }
}

describe('isChunkLoadError', () => {
  it('recognises the three engine wordings', () => {
    const chrome = new TypeError(
      'Failed to fetch dynamically imported module: https://pacepilot.pt/assets/TodayWorkoutView-DP7Tqp7x.js',
    )
    const firefox = new TypeError('error loading dynamically imported module')
    const safari = new TypeError('Importing a module script failed.')

    expect(isChunkLoadError(chrome)).toBe(true)
    expect(isChunkLoadError(firefox)).toBe(true)
    expect(isChunkLoadError(safari)).toBe(true)
  })

  it('leaves an ordinary failure alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of null'))).toBe(false)
    expect(isChunkLoadError(new TypeError('x is not a function'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError('something else')).toBe(false)
  })
})

describe('reloadOnce', () => {
  it('reloads the first time', () => {
    const options = deps()
    expect(reloadOnce(options)).toBe(true)
    expect(options.reload).toHaveBeenCalledTimes(1)
  })

  it('refuses a second reload inside the window, so a broken bundle cannot loop', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    expect(reloadOnce({ storage, reload, now: () => 1_000 })).toBe(true)
    expect(reloadOnce({ storage, reload, now: () => 5_000 })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('recovers again once the window has passed', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    expect(reloadOnce({ storage, reload, now: () => 1_000 })).toBe(true)
    expect(reloadOnce({ storage, reload, now: () => 60_000 })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('still reloads when storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    const reload = vi.fn()
    expect(reloadOnce({ storage, reload })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('onModulePreloadError', () => {
  function preloadEvent(payload: unknown): Event & { prevented: boolean } {
    const event = new Event('vite:preloadError', { cancelable: true }) as Event & {
      prevented: boolean
      payload: unknown
    }
    event.payload = payload
    Object.defineProperty(event, 'prevented', {
      get: () => event.defaultPrevented,
    })
    return event
  }

  it('reports the payload and recovers, without rethrowing into the console', () => {
    const error = new TypeError('Importing a module script failed.')
    const event = preloadEvent(error)
    const report = vi.fn()
    const reload = vi.fn()

    onModulePreloadError(event, { report, reload })

    // Vite rethrows the error unless the event is cancelled.
    expect(event.defaultPrevented).toBe(true)
    expect(report).toHaveBeenCalledWith(error)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('still reports when the event carries no payload', () => {
    const event = preloadEvent(undefined)
    const report = vi.fn()

    onModulePreloadError(event, { report, reload: vi.fn() })

    const [reported] = report.mock.calls[0] ?? []
    expect(reported).toBeInstanceOf(Error)
    expect((reported as Error).message).toBe('Module preload failed')
  })
})
