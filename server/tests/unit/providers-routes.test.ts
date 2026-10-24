import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

/**
 * The generic provider surface is the contract; `/api/strava/*` is a forwarding
 * alias for one release. Both must answer without a database or a session.
 */
test('provider routes answer publicly and the legacy alias forwards', async () => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    const list = await fetch(`${base}/api/providers`)
    assert.equal(list.status, 200)
    const body = (await list.json()) as {
      providers: Array<{ id: string; labelKey: string; capabilities: { pull: boolean } }>
    }
    assert.equal(body.providers[0]?.id, 'strava')
    assert.equal(body.providers[0]?.labelKey, 'providers.strava')
    assert.equal(body.providers[0]?.capabilities.pull, true)

    const status = await fetch(`${base}/api/providers/status`)
    assert.equal(status.status, 200)
    assert.deepEqual(await status.json(), {
      connected: false,
      last_synced_at: null,
      connections: [],
    })

    const legacy = await fetch(`${base}/api/strava/status`)
    assert.equal(legacy.status, 200)
    assert.equal((await legacy.json() as { connected: boolean }).connected, false)
  } finally {
    server.close()
  }
})
