import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

/**
 * A deployment that has not configured the push subscription yet is a normal
 * state, not a fault: the endpoint must answer safely rather than 500 and must
 * never treat an unverifiable call as authentic.
 */
process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = ''
process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID = ''

const { createApp } = await import('@/app.ts')

async function withApp(run: (base: string) => Promise<void>): Promise<void> {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
  }
}

describe('provider webhook — unconfigured deployment', () => {
  test('the handshake reports the missing configuration', async () => {
    await withApp(async (base) => {
      const res = await fetch(
        `${base}/api/providers/strava/webhook?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=abc`,
      )
      assert.equal(res.status, 503)
      const body = (await res.json()) as { error?: string }
      assert.match(body.error ?? '', /not configured/i)
    })
  })

  test('an unauthenticated delivery is refused, not accepted', async () => {
    await withApp(async (base) => {
      const res = await fetch(`${base}/api/providers/strava/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 9001,
          aspect_type: 'create',
          owner_id: 4242,
          subscription_id: 314159,
          event_time: 1710000000,
        }),
      })
      assert.equal(res.status, 503)
      const body = (await res.json()) as { error?: string }
      assert.match(body.error ?? '', /not configured/i)
    })
  })
})
