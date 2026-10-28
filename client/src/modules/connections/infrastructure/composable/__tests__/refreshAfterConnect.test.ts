/**
 * The connect flow is the one moment the app knows a batch of data is about to
 * become readable. The caller enters the app as soon as this chain resolves, so
 * the destination reads have to be fresh at that instant — not a re-read that
 * lands a frame after the screen renders, and not a screen left empty because an
 * unrelated read failed, hung or answered late.
 *
 * Tested through the chain and the Resource module the views read through, with
 * the transport stubbed: no component mounts.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { refreshAfterConnect } from '@/modules/connections/infrastructure/composable/refreshAfterConnect.ts'
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

function planReader(): ReturnType<typeof useResource<PlanWeekResponse>> {
  return useResource<PlanWeekResponse>(RESOURCE_KEYS.planWeek, () => api.plan.week(), {
    immediate: false,
  })
}

describe('refreshAfterConnect', () => {
  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
    resetResource()
  })

  it('leaves the plan week holding the imported week before it resolves', async () => {
    let planReads = 0
    const requested = serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': IMPORTED,
      // The refresh the import triggers is the slow read: a re-read that lands
      // after the chain resolved would leave the destination on its old value.
      '/plan/week': async () => {
        planReads += 1
        if (planReads > 1) await new Promise((resolve) => setTimeout(resolve, 30))
        return planReads > 1 ? { week: ['imported run'] } : { week: [] }
      },
      ...TODAY_EMPTY,
    })

    const plan = planReader()
    await plan.reload()
    expect(plan.data.value).toEqual({ week: [] })

    await refreshAfterConnect()

    // No `waitFor`: the caller navigates as soon as this resolves.
    expect(plan.data.value).toEqual({ week: ['imported run'] })
    expect(requested.indexOf('/providers/strava/sync')).toBeLessThan(
      requested.lastIndexOf('/plan/week'),
    )
  })

  it('re-reads a destination read that was already on the wire when the import landed', async () => {
    let planReads = 0
    serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': IMPORTED,
      // The first read started before the import and answers after it: its
      // answer cannot be the refreshed one.
      '/plan/week': async () => {
        planReads += 1
        if (planReads === 1) await new Promise((resolve) => setTimeout(resolve, 20))
        return planReads === 1 ? { week: [] } : { week: ['imported run'] }
      },
      ...TODAY_EMPTY,
    })

    const plan = planReader()
    const early = plan.reload()

    await refreshAfterConnect()
    await early

    expect(plan.data.value).toEqual({ week: ['imported run'] })
  })

  it('refreshes the destination even when the connection and account reads fail', async () => {
    let statusReads = 0
    serve({
      '/providers/status': () => {
        statusReads += 1
        // The import's preflight answers; the confirmation read after it fails.
        return statusReads > 1 ? offline() : CONNECTED()
      },
      '/providers/strava/sync': IMPORTED,
      '/plan/week': () => ({ week: ['imported run'] }),
      '/plan/feedback': () => [],
      '/activities': () => ({ items: [] }),
      '/me': () => offline(500),
    })

    const plan = planReader()
    await plan.reload()

    await expect(refreshAfterConnect()).resolves.toBeUndefined()

    expect(plan.data.value).toEqual({ week: ['imported run'] })
  })

  it("refreshes the plan when today's session reads fail", async () => {
    serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': IMPORTED,
      '/plan/week': () => ({ week: ['imported run'] }),
      '/plan/feedback': () => offline(),
      '/activities': () => offline(),
      '/me': () => ({ user: { id: '1' } }),
    })

    const plan = planReader()
    await plan.reload()

    await expect(refreshAfterConnect()).resolves.toBeUndefined()

    expect(plan.data.value).toEqual({ week: ['imported run'] })
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

  it('still refreshes the destination when the import fails, and rejects nothing', async () => {
    serve({
      '/providers/status': CONNECTED,
      '/providers/strava/sync': () => offline(502),
      '/plan/week': () => ({ week: ['imported run'] }),
      ...TODAY_EMPTY,
    })

    const plan = planReader()
    await plan.reload()

    await expect(refreshAfterConnect()).resolves.toBeUndefined()

    expect(plan.data.value).toEqual({ week: ['imported run'] })
  })
})
