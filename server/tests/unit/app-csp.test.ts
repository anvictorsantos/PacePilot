import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'

import { createApp } from '@/app.ts'

/**
 * Regression guard for the Render deploy: helmet's CSP used to be invisible
 * because Netlify's CDN served index.html with no policy. It now governs the
 * SPA, so the two hosts the client genuinely loads must stay allowed:
 * googletagmanager.com (GA4 script) and 'unsafe-eval' (vue-i18n's runtime
 * message compiler).
 */
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
    assert.match(csp, /script-src [^;]*'unsafe-eval'/)
    assert.match(csp, /script-src [^;]*https:\/\/unpkg\.com/)
    assert.match(csp, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/)
    assert.match(csp, /connect-src [^;]*https:\/\/tiles\.mapterhorn\.com/)
    assert.match(csp, /frame-src [^;]*https:\/\/www\.googletagmanager\.com/)
  } finally {
    server.close()
  }
})
