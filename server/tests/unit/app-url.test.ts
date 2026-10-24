import test from 'node:test'
import assert from 'node:assert/strict'

import { canonicalAppUrl } from '@/modules/shared/infrastructure/config/env.ts'

/**
 * Regression guard: CLIENT_URL is an allowlist, so interpolating it into a
 * redirect produced `https://apex,https://www/login`. The canonical base is one
 * origin, never the comma list.
 */
test('canonicalAppUrl resolves a single redirect origin', async (t) => {
  await t.test('keeps a single origin untouched', () => {
    assert.equal(canonicalAppUrl('https://pacepilot.pt'), 'https://pacepilot.pt')
  })

  await t.test('takes the first entry of an allowlist, trimmed', () => {
    assert.equal(
      canonicalAppUrl('https://pacepilot.pt, https://www.pacepilot.pt'),
      'https://pacepilot.pt',
    )
  })

  await t.test('strips trailing slashes so redirects do not double up', () => {
    assert.equal(canonicalAppUrl('https://pacepilot.pt/'), 'https://pacepilot.pt')
  })

  await t.test('APP_URL wins when the canonical host is not first', () => {
    assert.equal(
      canonicalAppUrl('https://www.pacepilot.pt,https://pacepilot.pt', 'https://pacepilot.pt/'),
      'https://pacepilot.pt',
    )
  })
})
