import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

// Regression guard for the Render deploy: the same process serves the SPA, so the
// third-party script the client genuinely loads stays allowed. unpkg was removed
// when MapLibre became a bundled dependency.
test('CSP allows the third-party script and eval the SPA actually needs', async () => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`)
    const csp = res.headers.get('content-security-policy') ?? ''

    assert.match(csp, /script-src 'self'/)
    assert.match(csp, /script-src [^;]*https:\/\/www\.googletagmanager\.com/)
    assert.doesNotMatch(csp, /'unsafe-eval'/)
    assert.doesNotMatch(csp, /unpkg\.com/)
    assert.match(csp, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/)
    assert.match(csp, /connect-src [^;]*https:\/\/tiles\.mapterhorn\.com/)
    assert.match(csp, /img-src [^;]*https:\/\/dgalywyr863hv\.cloudfront\.net/)
    assert.match(csp, /frame-src [^;]*https:\/\/www\.googletagmanager\.com/)
  } finally {
    server.close()
  }
})
