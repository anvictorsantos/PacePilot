import { afterEach, describe, expect, it, vi } from 'vitest'

import { autoSyncGate } from '@/modules/connections/infrastructure/composable/auto-sync-gate.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { http } from '@/modules/shared/infrastructure/http/client.ts'

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

describe('useConnection', () => {
  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
    resetResource()
    autoSyncGate.rearm()
  })

  it('checks connected', async () => {
    respond({ connected: true })
    const { checkStatus, connected } = useConnection()
    await expect(checkStatus()).resolves.toBe(true)
    expect(connected.value).toBe(true)
  })

  it('reports a disconnected session instead of throwing', async () => {
    respond({ connected: false })
    const { checkStatus } = useConnection()
    await expect(checkStatus(true)).resolves.toBe(false)
  })

  it('reads /providers/status once per page load, however many callers ask', async () => {
    const calls = vi.fn()
    http.defaults.adapter = async (config) => {
      calls()
      return { data: { connected: true }, status: 200, statusText: 'OK', headers: {}, config }
    }

    await Promise.all([useConnection().checkStatus(true), useConnection().checkStatus(true)])

    expect(calls).toHaveBeenCalledTimes(1)
  })

  it('shows a written answer to every reader, so the avatar, notice and sync agree', () => {
    respond({ connected: true })
    const avatar = useConnection()
    const feed = useConnection()

    feed.setConnected(false)
    expect(avatar.connected.value).toBe(false)
    expect(avatar.checked.value).toBe(true)

    avatar.setConnected(true)
    expect(feed.connected.value).toBe(true)
  })

  it("does not let a local answer outlive the server's", async () => {
    respond({ connected: true })
    const { setConnected, connected, checkStatus } = useConnection()
    // Disconnect, then the same provider is re-linked elsewhere in the account.
    setConnected(false)
    expect(connected.value).toBe(false)

    await checkStatus(true)

    // Reloading used to keep the local `false`: the notice, the red dot and the
    // disabled sync survived two page loads.
    expect(connected.value).toBe(true)
  })

  it('prefers a server "not connected" over a local optimistic write', async () => {
    respond({ connected: false })
    const { setConnected, connected, checkStatus } = useConnection()
    setConnected(true)
    expect(connected.value).toBe(true)

    await checkStatus(true)

    expect(connected.value).toBe(false)
  })

  it('does not let a status read already in flight win over the later one', async () => {
    let releaseStale: (value: unknown) => void = () => {}
    const stale = new Promise<unknown>((resolve) => {
      releaseStale = resolve
    })
    let calls = 0
    http.defaults.adapter = async (config) => {
      calls += 1
      // The first read started before the callback committed the link.
      const data = calls === 1 ? await stale : { connected: true }
      return { data, status: 200, statusText: 'OK', headers: {}, config }
    }

    const { checkStatus, setConnected, connected } = useConnection()
    const early = checkStatus(true)
    // The popup message landed: the app now knows the link is committed.
    setConnected(true)
    const late = checkStatus(true)
    await late

    releaseStale({ connected: false })
    await early

    expect(connected.value).toBe(true)
  })

  it('re-arms the automatic import when a provider is linked or dropped', () => {
    respond({ connected: false })
    autoSyncGate.markAttempt(Date.now())

    useConnection().setConnected(false)

    // The next app load must be allowed to import against the new link, however
    // recently the previous connection's attempt was stamped.
    expect(autoSyncGate.canAttempt(Date.now(), null)).toBe(true)
  })

  it('re-arms the automatic import when the connection is forgotten', () => {
    respond({ connected: false })
    autoSyncGate.markAttempt(Date.now())

    useConnection().resetConnection()

    expect(autoSyncGate.canAttempt(Date.now(), null)).toBe(true)
  })
})
