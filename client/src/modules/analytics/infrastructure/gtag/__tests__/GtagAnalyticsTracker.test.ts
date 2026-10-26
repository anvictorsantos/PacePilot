/**
 * The adapter owns the queue order and the wire shape, and both are hard to see
 * from the outside, so the test reads `dataLayer` back the way gtag.js does.
 * The globals are stubbed rather than jsdom'd: `dataLayer.ts` is the module's
 * only `window` access, and this is the small slice of it the adapter touches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { GtagAnalyticsTracker } from '@/modules/analytics/infrastructure/gtag/GtagAnalyticsTracker.ts'

interface GtagWindow {
  dataLayer: ArrayLike<unknown>[]
  location: { origin: string; pathname: string }
  gtag?: (...args: unknown[]) => void
}

interface LoadedScript {
  id: string
  src: string
  async: boolean
}

let win: GtagWindow
let loaded: LoadedScript[]

/** Every queued command, in the order gtag.js would read it. */
function queue(): unknown[][] {
  return win.dataLayer.map((entry) => Array.from(entry))
}

function commandsNamed(command: string): unknown[][] {
  return queue().filter((entry) => entry[0] === command)
}

/** The most recently queued command. */
function lastCommand(): unknown[] {
  return queue()[queue().length - 1] ?? []
}

beforeEach(() => {
  loaded = []
  win = {
    dataLayer: [],
    location: { origin: 'https://pacepilot.app', pathname: '/workout' },
  }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', {
    title: 'PacePilot',
    head: { appendChild: (script: LoadedScript) => loaded.push(script) },
    getElementById: (id: string) => loaded.find((script) => script.id === id) ?? null,
    createElement: () => ({ id: '', src: '', async: false }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GtagAnalyticsTracker', () => {
  it('denies consent before it configures the tag', () => {
    new GtagAnalyticsTracker('G-TEST')

    expect(queue()[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      },
    ])
    // The default has to be queued before anything that could follow it.
    expect(queue().findIndex(([command]) => command === 'config')).toBeGreaterThan(0)
  })

  it('queues the entry shape gtag.js reads, never a plain array', () => {
    new GtagAnalyticsTracker('G-TEST')

    // A regression guard: gtag.js walks the queue expecting `arguments` objects
    // and ignores arrays without an error, so an array here means zero hits on a
    // queue that looks perfect.
    expect(win.dataLayer.length).toBeGreaterThan(0)
    expect(win.dataLayer.every((entry) => !Array.isArray(entry))).toBe(true)
  })

  it('queues config before the script arrives, and never fetches it unasked', () => {
    new GtagAnalyticsTracker('G-MEASURE', true)

    expect(loaded).toEqual([])
    expect(queue()).toContainEqual([
      'config',
      'G-MEASURE',
      { send_page_view: false, debug_mode: true },
    ])
  })

  it('fetches the tag on the first granted consent, once', () => {
    const tracker = new GtagAnalyticsTracker('G-MEASURE')

    tracker.setConsent(AnalyticsConsent.Denied)
    expect(loaded).toEqual([])

    tracker.setConsent(AnalyticsConsent.Granted)
    tracker.setConsent(AnalyticsConsent.Granted)

    expect(loaded).toEqual([
      {
        id: 'ga4-gtag',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-MEASURE',
        async: true,
      },
    ])
  })

  it('mirrors a decision into Consent Mode', () => {
    const tracker = new GtagAnalyticsTracker('G-TEST')

    tracker.setConsent(AnalyticsConsent.Granted)
    tracker.setConsent(AnalyticsConsent.Denied)

    expect(commandsNamed('consent').slice(-2)).toEqual([
      ['consent', 'update', { analytics_storage: 'granted' }],
      ['consent', 'update', { analytics_storage: 'denied' }],
    ])
  })

  it('sends an event with its params', () => {
    const tracker = new GtagAnalyticsTracker('G-TEST')

    tracker.trackEvent(AnalyticsEventName.WorkoutLogged, { source: 'strava' })

    expect(lastCommand()).toEqual(['event', 'workout_logged', { source: 'strava' }])
  })

  it('sends the route pattern, never the query string', () => {
    const tracker = new GtagAnalyticsTracker('G-TEST')

    tracker.pageView('/activities/:id')

    expect(lastCommand()).toEqual([
      'event',
      'page_view',
      {
        page_path: '/activities/:id',
        page_location: 'https://pacepilot.app/activities/:id',
        page_title: 'PacePilot',
      },
    ])
  })

  it('reports a storage failure instead of throwing', () => {
    const tracker = new GtagAnalyticsTracker('G-TEST')
    win.dataLayer.push = () => {
      throw new Error('quota')
    }

    expect(() => tracker.trackEvent(AnalyticsEventName.Signup)).not.toThrow()
  })
})
