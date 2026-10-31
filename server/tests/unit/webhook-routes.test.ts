import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

// Route seam: the provider calls these two URLs per environment with no session.
// The config must be set before the app imports `env.ts`, which reads the environment once.
process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'verify-token'
process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID = '314159'

const { createApp } = await import('@/app.ts')

const delivery = (over: Record<string, unknown> = {}) => ({
  object_type: 'activity',
  object_id: 9001,
  aspect_type: 'create',
  owner_id: 4242,
  subscription_id: 314159,
  event_time: 1710000000,
  updates: {},
  ...over,
})

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

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('provider webhook — verification handshake', () => {
  test('answers the subscription challenge without a session or a database', async () => {
    await withApp(async (base) => {
      const res = await fetch(
        `${base}/api/providers/strava/webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=abc123`,
      )
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), { 'hub.challenge': 'abc123' })
    })
  })

  test('rejects a wrong verify token', async () => {
    await withApp(async (base) => {
      const res = await fetch(
        `${base}/api/providers/strava/webhook?hub.mode=subscribe&hub.verify_token=guess&hub.challenge=abc123`,
      )
      assert.equal(res.status, 403)
    })
  })

  test('serves the same handshake through the legacy alias', async () => {
    await withApp(async (base) => {
      const res = await fetch(
        `${base}/api/strava/webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=alias`,
      )
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), { 'hub.challenge': 'alias' })
    })
  })

  test('an unknown provider is a 404, not a crash', async () => {
    await withApp(async (base) => {
      const res = await fetch(`${base}/api/providers/garmin/webhook?hub.mode=subscribe`)
      assert.equal(res.status, 404)
    })
  })
})

describe('provider webhook — deliveries', () => {
  test('rejects a delivery for another subscription', async () => {
    await withApp(async (base) => {
      const res = await post(`${base}/api/providers/strava/webhook`, delivery({ subscription_id: 999 }))
      assert.equal(res.status, 401)
    })
  })

  test('rejects an envelope without the provider athlete', async () => {
    await withApp(async (base) => {
      const res = await post(`${base}/api/providers/strava/webhook`, { object_type: 'activity' })
      assert.equal(res.status, 400)
    })
  })

  test('bounds the payload instead of buffering an arbitrary body', async () => {
    await withApp(async (base) => {
      const res = await post(
        `${base}/api/providers/strava/webhook`,
        delivery({ updates: { pad: 'x'.repeat(9000) } }),
      )
      assert.equal(res.status, 413)
    })
  })

  test('an authorised delivery with the database down answers 503, not 500', async () => {
    await withApp(async (base) => {
      const res = await post(`${base}/api/providers/strava/webhook`, delivery())
      assert.equal(res.status, 503)
      const body = (await res.json()) as { error?: string }
      assert.match(body.error ?? '', /Database/)
    })
  })
})
