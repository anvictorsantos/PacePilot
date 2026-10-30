import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import type { CanonicalActivity, CanonicalActivityPage } from '@/modules/providers/domain/CanonicalActivity.ts'
import type { ActivityProvider } from '@/modules/providers/domain/ports/ActivityProvider.ts'
import type { BackfillCursorRepository } from '@/modules/providers/domain/ports/BackfillCursorRepository.ts'
import {
  BACKFILL_STALE_MS,
  beginBackfillStep,
  emptyBackfill,
  isBackfillRunnable,
  pauseBackfill,
  planBackfillStart,
  type BackfillState,
} from '@/modules/providers/domain/backfill.ts'
import {
  queueBackfill,
  runBackfillStep,
  stopBackfill,
  type BackfillDeps,
} from '@/modules/providers/application/backfill.service.ts'
import { Sport } from '@/modules/activities/domain/value-object/Sport.ts'

/**
 * The step and the cursor are only safe together. These tests drive the service
 * through an in-memory cursor, so claim contention, a stop that lands mid-page
 * and a re-link that re-arms history are asserted as behaviour rather than as a
 * predicate that happens to agree with it.
 */

const ATHLETE = '5f0b0f0f0f0f0f0f0f0f0f0f'
const PROVIDER = 'strava'
const NOW = new Date('2026-05-01T12:00:00.000Z')
const DAY_MS = 86400000

const activity = (externalId: string, startedAt: Date): CanonicalActivity => ({
  externalId,
  startedAt,
  rawSport: 'Run',
  sport: Sport.Run,
  distanceM: 10000,
  movingTimeS: 3000,
  elapsedTimeS: 3000,
  avgSpeedMps: 3.33,
  maxSpeedMps: null,
  elevationM: 0,
  avgHr: null,
  maxHr: null,
  avgCadenceSpm: null,
  hasHr: false,
  calories: null,
  achievementCount: 0,
  prCount: 0,
  raw: {},
})

const capabilities = {
  pull: true,
  webhook: false,
  streams: false,
  laps: false,
  segments: false,
  zones: false,
  profile: false,
}

/** A cursor held in memory, with the same compare-and-set guards as Mongo. */
function memoryCursor({
  state = null as BackfillState | null,
  anchor = new Date(NOW.getTime() - DAY_MS),
} = {}) {
  const cursor = {
    state,
    saves: 0,
    claims: 0,
  }
  const store: BackfillCursorRepository = {
    async load() {
      return cursor.state
    },
    async create(_athleteId, _provider, next) {
      if (!cursor.state) cursor.state = next
    },
    async replacePendingPlan(_athleteId, _provider, next) {
      if (cursor.state?.status !== 'pending') return false
      cursor.state = next
      return true
    },
    async replaceUnlessRunning(_athleteId, _provider, next) {
      if (!cursor.state || cursor.state.status === 'running') return false
      cursor.state = next
      return true
    },
    async claim(_athleteId, _provider, at) {
      if (!cursor.state || !isBackfillRunnable(cursor.state, at)) return null
      cursor.claims++
      cursor.state = beginBackfillStep(cursor.state, at)
      return cursor.state
    },
    async save(_athleteId, _provider, next) {
      // A pause recorded while the step ran wins over its progress.
      if (cursor.state?.status !== 'running') return
      cursor.saves++
      cursor.state = next
    },
    async pauseRunning(_athleteId, _provider, at) {
      if (!cursor.state) return
      cursor.state = pauseBackfill(cursor.state, at)
    },
    async oldestActivityAt() {
      return anchor
    },
  }
  return { store, cursor }
}

interface StepOptions {
  pages?: CanonicalActivityPage[]
  onPage?: (page: number) => Promise<void> | void
}

/** A provider whose pages are handed over one at a time, optionally gated. */
function fakeProvider({ pages = [], onPage }: StepOptions = {}) {
  const fetched: Date[] = []
  const provider = {
    id: PROVIDER,
    capabilities,
    async listActivities(
      _token: string,
      query: { before?: Date } = {},
    ): Promise<CanonicalActivityPage> {
      fetched.push(query.before ?? new Date(0))
      await onPage?.(fetched.length)
      const page = pages[Math.min(fetched.length, pages.length) - 1]
      return page ?? { items: [], hasMore: false }
    },
  }
  return { provider: provider as unknown as ActivityProvider, fetched }
}

function depsFor(
  store: BackfillCursorRepository,
  provider: ActivityProvider,
  { now = () => NOW }: { now?: () => Date } = {},
): BackfillDeps {
  return {
    store,
    provider: () => provider,
    connection: async () => ({
      athlete: ATHLETE,
      provider: PROVIDER,
      external_athlete_id: '42',
      access_token: 'ciphertext',
    }),
    accessToken: async () => 'access-token',
    persist: async (_athleteId, _provider, items) => ({ imported: items.length, skipped: 0 }),
    now,
    ready: () => true,
  }
}

function queued(over: Partial<BackfillState> = {}): BackfillState {
  return {
    ...planBackfillStart({ now: NOW, oldestActivityAt: new Date(NOW.getTime() - DAY_MS), windowDays: 90 }),
    ...over,
  }
}

describe('backfill claim', () => {
  test('a live claim is not stolen: the second caller reports progress and fetches nothing', async () => {
    // Another instance holds the cursor and heartbeat seconds ago.
    const running = beginBackfillStep(queued(), NOW)
    const { store, cursor } = memoryCursor({ state: running })
    const { provider, fetched } = fakeProvider()

    const progress = await runBackfillStep(
      { athleteId: ATHLETE, providerId: PROVIDER },
      depsFor(store, provider),
    )

    assert.equal(progress.status, 'running')
    assert.equal(fetched.length, 0, 'the loser must not page the same range')
    assert.equal(cursor.claims, 0)
  })

  test('a stale claim is taken over, so a dead step cannot wedge the cursor', async () => {
    const running = beginBackfillStep(queued(), NOW)
    const stale = new Date(NOW.getTime() + BACKFILL_STALE_MS + 1000)
    const { store } = memoryCursor({ state: running })
    const { provider, fetched } = fakeProvider()

    const progress = await runBackfillStep(
      { athleteId: ATHLETE, providerId: PROVIDER },
      depsFor(store, provider, { now: () => stale }),
    )

    assert.equal(fetched.length, 1, 'the takeover calls the provider once')
    assert.equal(progress.status, 'complete', 'an empty page ends the walk')
  })

  test('two concurrent requests walk the range once, not twice', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { store, cursor } = memoryCursor({ state: queued() })
    const { provider, fetched } = fakeProvider({
      pages: [
        { items: [activity('a1', new Date(NOW.getTime() - 2 * DAY_MS))], hasMore: false },
      ],
      onPage: (page) => (page === 1 ? gate : undefined),
    })
    const deps = depsFor(store, provider)

    const first = runBackfillStep({ athleteId: ATHLETE, providerId: PROVIDER }, deps)
    // Let the winner take the claim and enter its first page.
    await new Promise((resolve) => setImmediate(resolve))
    const second = await runBackfillStep({ athleteId: ATHLETE, providerId: PROVIDER }, deps)

    assert.equal(second.status, 'running')
    assert.equal(fetched.length, 1, 'the second caller must not fetch')
    release()
    const winner = await first

    assert.equal(winner.imported, 1)
    assert.equal(cursor.claims, 1)
    assert.equal(fetched.length, 1)
  })

  test('a row left idle is planned on the first step instead of wedging', async () => {
    const { store } = memoryCursor({ state: emptyBackfill() })
    const { provider, fetched } = fakeProvider()

    const progress = await runBackfillStep(
      { athleteId: ATHLETE, providerId: PROVIDER },
      depsFor(store, provider),
    )

    assert.equal(fetched.length, 1, 'the plan was stored and claimed in the same request')
    assert.equal(progress.status, 'complete')
  })

  test('a pause from a manual sync stops the walk and the next step resumes', async () => {
    let paused = false
    const { store, cursor } = memoryCursor({ state: queued() })
    const { provider, fetched } = fakeProvider({
      pages: [
        { items: [activity('a1', new Date(NOW.getTime() - 2 * DAY_MS))], hasMore: true },
        { items: [activity('a2', new Date(NOW.getTime() - 3 * DAY_MS))], hasMore: false },
      ],
      onPage: async (page) => {
        if (page === 1 && !paused) {
          paused = true
          await store.pauseRunning(ATHLETE, PROVIDER, NOW)
        }
      },
    })
    const deps = depsFor(store, provider)

    const first = await runBackfillStep({ athleteId: ATHLETE, providerId: PROVIDER }, deps)

    assert.equal(first.status, 'paused')
    assert.equal(fetched.length, 1, 'the pause is noticed before the next provider call')
    // The paused progress was not overwritten by the step's advance: the cursor
    // still points at the page the pause interrupted, so nothing is skipped.
    assert.equal(cursor.state?.cursorBefore?.getTime(), queued().cursorBefore?.getTime())

    const resumed = await runBackfillStep({ athleteId: ATHLETE, providerId: PROVIDER }, deps)
    assert.equal(fetched.length, 2, 'the resume picks up from the same cursor')
    assert.equal(resumed.status, 'complete')
  })
})

describe('backfill stop', () => {
  test('a stop during a step wins: progress is not written over the pause', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { store, cursor } = memoryCursor({ state: queued() })
    const { provider } = fakeProvider({
      pages: [{ items: [activity('a1', new Date(NOW.getTime() - 2 * DAY_MS))], hasMore: true }],
      onPage: (page) => (page === 1 ? gate : undefined),
    })
    const deps = depsFor(store, provider)

    const step = runBackfillStep({ athleteId: ATHLETE, providerId: PROVIDER }, deps)
    // The step is inside the provider call when the athlete taps stop.
    await new Promise((resolve) => setImmediate(resolve))
    const stopped = await stopBackfill(ATHLETE, PROVIDER, deps)
    release()
    const progress = await step

    assert.equal(stopped.status, 'paused')
    assert.equal(progress.status, 'paused')
    assert.equal(cursor.saves, 0, 'the step did not overwrite the pause')
    assert.equal(cursor.state?.status, 'paused')
  })

  test('a stop that loses to a completing step leaves the walk complete', async () => {
    const { store } = memoryCursor({ state: queued() })
    const { provider } = fakeProvider()

    const completed = await runBackfillStep(
      { athleteId: ATHLETE, providerId: PROVIDER },
      depsFor(store, provider),
    )
    assert.equal(completed.status, 'complete')

    // The athlete taps stop after that response was generated.
    const late = await stopBackfill(ATHLETE, PROVIDER, depsFor(store, provider))
    assert.equal(late.status, 'complete', 'a finished walk must not become permanently paused')
    assert.equal(late.hasMore, false)
  })
})

describe('backfill re-link', () => {
  test('a completed walk with an old floor is re-armed on link', async () => {
    const oldFloor = new Date(NOW.getTime() - 200 * DAY_MS)
    const complete: BackfillState = {
      ...emptyBackfill(),
      status: 'complete',
      floor: oldFloor,
      cursorBefore: new Date(NOW.getTime() - 300 * DAY_MS),
      pagesDone: 4,
      imported: 40,
      requestedAt: new Date(NOW.getTime() - 200 * DAY_MS),
      updatedAt: new Date(NOW.getTime() - 200 * DAY_MS),
    }
    const { store, cursor } = memoryCursor({ state: complete })

    await queueBackfill(ATHLETE, PROVIDER, depsFor(store, fakeProvider().provider))

    assert.equal(cursor.state?.status, 'pending')
    assert.ok(cursor.state?.floor)
    assert.ok(
      cursor.state!.floor!.getTime() > oldFloor.getTime(),
      'the floor moves forward with the retention window',
    )
    assert.ok(
      cursor.state!.cursorBefore!.getTime() < NOW.getTime(),
      'the cursor sits below the oldest stored activity again',
    )
    assert.equal(cursor.state?.imported, 40, 'the counters describe the athlete, not one run')
  })

  test('a walk still inside the retention window is not disturbed by a re-link', async () => {
    const paused = pauseBackfill(
      beginBackfillStep(queued(), NOW),
      NOW,
    )
    const { store, cursor } = memoryCursor({ state: paused })

    await queueBackfill(ATHLETE, PROVIDER, depsFor(store, fakeProvider().provider))

    assert.deepEqual(cursor.state, paused)
  })
})
