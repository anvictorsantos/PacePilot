import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

/** GET with the browser-shaped Origin header (fetch forbids setting it). */
function get(url: string, origin: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { headers: { origin } }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode ?? 0))
    })
    req.on('error', reject)
    req.end()
  })
}

/**
 * CORS governs API responses, not every response: the SPA's module scripts are
 * fetched with an Origin header, so a global guard 403'd the vendor chunks.
 */
test('CORS denies a foreign origin on the API but never on static assets', async () => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    const asset = await get(`${base}/assets/vendor-vue.js`, 'https://evil.example')
    assert.notEqual(asset, 403, 'a static asset must not be answered with the API CORS error')

    const denied = await get(`${base}/api/health`, 'https://evil.example')
    assert.equal(denied, 403)

    const sameHost = await get(`${base}/api/health`, base)
    assert.equal(sameHost, 200, 'the SPA served by this process is same-origin')
  } finally {
    server.close()
  }
})
