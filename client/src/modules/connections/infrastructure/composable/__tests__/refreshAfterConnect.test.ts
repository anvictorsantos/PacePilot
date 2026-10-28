/**
 * The connect flow is the one moment the app knows a batch of data is about to
 * become readable, and the caller enters the app as soon as this chain resolves.
 *
 * Two guarantees are tested, because two are what the chain actually gives: the
 * import has landed, and today's session — which is not a Resource — has been
 * re-read. The cached reads are only marked stale; the destination reads Today,
 * the plan and progress straight from the API, so no reader in this test may
 * stand in for a refresh the real schedule never performs.
 *
 * Tested through the chain and the module the views read through, with the
 * transport stubbed: no component mounts.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import { refreshAfterConnect } from '@/modules/connections/infrastructure/composable/refreshAfterConnect.ts'
import { useRunDay } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { resetResource, useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api, http } from '@/modules/shared/infrastructure/http/client.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'
import type { PlanWeekResponse } from '@/modules/training/infrastructure/dto/PlanWeekResponse.ts'

const defaultAdapter = http.defaults.adapter

type Reply = unknown | Promise<unknown>

/**
 * A transport that answers by path. A path nobody declared fails like an
 * unexpected request, so a read this chain should not spend is visible.
 */
function serve(routes: Record<string, () => Reply>): string[] {
  const requested: string[] = []
  http.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    requested.push(url)
    const route = routes[url]
    if (!route) throw new Error(`unexpected request: ${url}`)
    const data = await route()
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return requested
}

function offline(status = 503): Promise<never> {
  return Promise.reject(
    Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      response: { data: {}, status, statusText: 'ERR', headers: {} },
    }),
  )
}

const CONNECTED = () => ({ connected: true, provider: 'strava' })
const IMPORTED = () => ({ imported: 2 })

/** Today's session reads these two; they answer empty unless a test says otherwise. */
const TODAY_EMPTY = {
  '/plan/feedback': () => [],
  '/activities': () => ({ items: [] }),
  '/me': () => ({ user: { id: '1' } }),
}

describe('refreshAfterConnect', () => {
  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
    resetResource()
  })

  it('marks the plan read stale, so the destination fetches instead of the pre-connect value', async () => {
    let planReads = 0
    const requested = serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': IMPORTED,
      '/plan/week': () => {
        planReads += 1
        return planReads > 1 ? { week: ['imported run'] } : { week: [] }
      },
      ...TODAY_EMPTY,
    })

    // A previous visit cached the plan and then left the screen: exactly what the
    // destination finds when it mounts, and why no reader stands in for it here.
    const scope = effectScope()
    const left = scope.run(() =>
      useResource<PlanWeekResponse>(RESOURCE_KEYS.planWeek, () => api.plan.week(), {
        immediate: false,
      }),
    )
    if (!left) throw new Error('reader not created inside the scope')
    await left.reload()
    expect(left.data.value).toEqual({ week: [] })
    scope.stop()

    await refreshAfterConnect()

    // The destination reads the key for the first time: it must fetch, not be
    // served the plan from before the import.
    const destination = useResource<PlanWeekResponse>(
      RESOURCE_KEYS.planWeek,
      () => api.plan.week(),
      { immediate: false },
    )
    expect(await destination.reload()).toEqual({ week: ['imported run'] })
    expect(requested.indexOf('/providers/strava/sync')).toBeLessThan(
      requested.lastIndexOf('/plan/week'),
    )
  })

  it("re-reads today's session before it resolves, so the imported run is on the card", async () => {
    const todayKey = LocalDateKey.today().value
    serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': IMPORTED,
      '/plan/week': () => ({ week: [] }),
      '/plan/feedback': () => [],
      '/activities': () => ({
        items: [{ id: 7, date: todayKey, kind: 'run', workout_type: 'easy' }],
      }),
      '/me': () => ({ user: { id: '1' } }),
    })

    await refreshAfterConnect()

    // Today is a module projection, not a Resource: no `waitFor` — the card has
    // the run at the instant the caller is allowed to navigate.
    const { completed, activity } = useRunDay()
    expect(completed.value).toBe(true)
    expect(activity.value?.id).toBe(7)
  })

  it('still refreshes the destination when the import fails, and rejects nothing', async () => {
    const requested = serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': () => offline(502),
      '/plan/week': () => ({ week: ['imported run'] }),
      ...TODAY_EMPTY,
    })

    await expect(refreshAfterConnect()).resolves.toBeUndefined()

    const destination = useResource<PlanWeekResponse>(
      RESOURCE_KEYS.planWeek,
      () => api.plan.week(),
      { immediate: false },
    )
    expect(await destination.reload()).toEqual({ week: ['imported run'] })
    expect(requested.lastIndexOf('/plan/week')).toBeGreaterThan(
      requested.indexOf('/providers/strava/sync'),
    )
  })

  it("refreshes the destination when today's session reads fail", async () => {
    serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': IMPORTED,
      '/plan/week': () => ({ week: ['imported run'] }),
      '/plan/feedback': () => offline(),
      '/activities': () => offline(),
      '/me': () => ({ user: { id: '1' } }),
    })

    await expect(refreshAfterConnect()).resolves.toBeUndefined()

    const destination = useResource<PlanWeekResponse>(
      RESOURCE_KEYS.planWeek,
      () => api.plan.week(),
      { immediate: false },
    )
    expect(await destination.reload()).toEqual({ week: ['imported run'] })
  })

  it('resolves without an answer from an auxiliary read', async () => {
    serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': IMPORTED,
      '/plan/week': () => ({ week: [] }),
      '/plan/feedback': () => [],
      '/activities': () => ({ items: [] }),
      // The profile read never answers: the destination must not wait for it.
      '/me': () => new Promise<unknown>(() => {}),
    })

    await expect(refreshAfterConnect()).resolves.toBeUndefined()
  })
})
