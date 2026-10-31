import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

test('backfill routes answer 503 without a database, under both prefixes', async () => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    const calls: Array<[string, string]> = [
      ['GET', '/api/providers/strava/backfill'],
      ['POST', '/api/providers/strava/backfill'],
      ['POST', '/api/providers/strava/backfill/stop'],
      ['GET', '/api/strava/backfill'],
    ]
    for (const [method, path] of calls) {
      const response = await fetch(`${base}${path}`, { method })
      assert.equal(response.status, 503, `${method} ${path}`)
      const body = (await response.json()) as { error?: string }
      assert.match(body.error ?? '', /Database not connected/)
    }
  } finally {
    server.close()
  }
})
