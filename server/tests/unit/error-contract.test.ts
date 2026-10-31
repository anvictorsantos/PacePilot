import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

test('a malformed JSON body returns a generic message, never the parser text', async () => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    assert.equal(res.status, 400)
    const body = (await res.json()) as { error?: string }
    assert.equal(body.error, 'Malformed request')
    assert.doesNotMatch(String(body.error), /position|Expected property|JSON\.parse/i)
  } finally {
    server.close()
  }
})
