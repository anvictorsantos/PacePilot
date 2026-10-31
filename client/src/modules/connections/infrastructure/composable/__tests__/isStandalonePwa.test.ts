import { afterEach, describe, expect, it, vi } from 'vitest'

import { isStandalonePwa } from '@/modules/connections/infrastructure/composable/isStandalonePwa.ts'

function stubWindow(win: unknown) {
  vi.stubGlobal('window', win)
}

function browserLike(navigator: Record<string, unknown>, displayModeMatches: boolean) {
  return {
    navigator,
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)' ? displayModeMatches : false,
    }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isStandalonePwa', () => {
  it('is true for a manifest-installed app', () => {
    stubWindow(browserLike({}, true))
    expect(isStandalonePwa()).toBe(true)
  })

  it('is true for an iOS home-screen app', () => {
    stubWindow(browserLike({ standalone: true }, false))
    expect(isStandalonePwa()).toBe(true)
  })

  it('is false in a normal browser tab', () => {
    stubWindow(browserLike({}, false))
    expect(isStandalonePwa()).toBe(false)
  })

  it('is false without a window (SSR, node)', () => {
    stubWindow(undefined)
    expect(isStandalonePwa()).toBe(false)
  })
})
