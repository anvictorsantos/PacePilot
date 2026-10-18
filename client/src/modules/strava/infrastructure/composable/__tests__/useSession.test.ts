import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { http } from '@/modules/shared/infrastructure/http/client.ts'
import { useSession } from '@/modules/strava/infrastructure/composable/useSession.ts'

const defaultAdapter = http.defaults.adapter

function respond(body: unknown) {
  http.defaults.adapter = async (config) => ({
    data: body,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
}

describe('useSession', () => {
  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
    resetResource()
  })

  it('checks connected', async () => {
    respond({ connected: true })
    const { checkStatus, connected } = useSession()
    await expect(checkStatus()).resolves.toBe(true)
    expect(connected.value).toBe(true)
  })

  it('reports a disconnected session instead of throwing', async () => {
    respond({ connected: false })
    const { checkStatus } = useSession()
    await expect(checkStatus(true)).resolves.toBe(false)
  })

  it('reads /strava/status once per page load, however many callers ask', async () => {
    const calls = vi.fn()
    http.defaults.adapter = async (config) => {
      calls()
      return { data: { connected: true }, status: 200, statusText: 'OK', headers: {}, config }
    }

    await Promise.all([useSession().checkStatus(true), useSession().checkStatus(true)])

    expect(calls).toHaveBeenCalledTimes(1)
  })

  it('trusts an explicit setConnected over the server read', () => {
    const { setConnected, connected, checked } = useSession()
    setConnected(false)
    expect(connected.value).toBe(false)
    expect(checked.value).toBe(true)
  })
})
