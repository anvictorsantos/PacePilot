import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

test('every /api response is non-cacheable, including anonymous ones', async () => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    for (const path of ['/api/health', '/api/me', '/api/activities']) {
      const res = await fetch(`${base}${path}`)
      assert.equal(
        res.headers.get('cache-control'),
        'no-store',
        `${path} must not be cacheable by a shared or browser cache`,
      )
    }
  } finally {
    server.close()
  }
})
