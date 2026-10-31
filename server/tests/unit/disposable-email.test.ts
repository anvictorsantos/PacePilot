import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { emailDomain } from '@/modules/auth/domain/email-reputation.ts'
import { DisifyEmailReputation } from '@/modules/auth/infrastructure/email/disify-email-reputation.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('emailDomain', () => {
  test('returns the lowercased domain', () => {
    assert.equal(emailDomain('runner@Kajaib.Studio'), 'kajaib.studio')
    assert.equal(emailDomain('a.b+tag@mail.example.co.uk.'), 'mail.example.co.uk')
  })

  test('rejects anything without a usable domain', () => {
    assert.equal(emailDomain('runner'), null)
    assert.equal(emailDomain('@example.com'), null)
    assert.equal(emailDomain('runner@'), null)
    assert.equal(emailDomain('runner@localhost'), null)
    assert.equal(emailDomain('runner@exa mple.com'), null)
  })
})

describe('DisifyEmailReputation', () => {
  test('reports a disposable domain', async () => {
    const checker = new DisifyEmailReputation(async () => jsonResponse({ disposable: true }))
    assert.deepEqual(await checker.check('denialexeeff@kajaib.studio'), { disposable: true })
  })

  test('reports a permanent domain', async () => {
    const checker = new DisifyEmailReputation(async () => jsonResponse({ disposable: false }))
    assert.deepEqual(await checker.check('runner@gmail.com'), { disposable: false })
  })

  test('sends only a probe local part, never the athlete address', async () => {
    const urls: string[] = []
    const checker = new DisifyEmailReputation(async (input) => {
      urls.push(String(input))
      return jsonResponse({ disposable: false })
    })
    await checker.check('real.athlete@kajaib.studio')
    assert.equal(urls.length, 1)
    assert.ok(urls[0].includes('probe%40kajaib.studio'))
    assert.equal(urls[0].includes('real.athlete'), false)
  })

  test('answers unknown on a rate limit instead of blocking signup', async () => {
    const checker = new DisifyEmailReputation(async () =>
      jsonResponse({ error: 'Rate limit exceeded' }, 429),
    )
    assert.equal(await checker.check('runner@gmail.com'), null)
  })

  test('answers unknown when the provider throws or times out', async () => {
    const throwing = new DisifyEmailReputation(async () => {
      throw new Error('The operation was aborted due to timeout')
    })
    assert.equal(await throwing.check('runner@gmail.com'), null)
  })

  test('answers unknown on a payload without a boolean verdict', async () => {
    const checker = new DisifyEmailReputation(async () => jsonResponse({ detail: 'nope' }))
    assert.equal(await checker.check('runner@gmail.com'), null)
  })

  test('caches a verdict per domain and expires it after a day', async () => {
    let calls = 0
    let now = Date.UTC(2026, 9, 31, 12, 0, 0)
    const checker = new DisifyEmailReputation(
      async () => {
        calls += 1
        return jsonResponse({ disposable: true })
      },
      () => now,
    )

    await checker.check('one@kajaib.studio')
    await checker.check('two@kajaib.studio')
    assert.equal(calls, 1)

    now += 24 * 60 * 60 * 1000 + 1
    await checker.check('three@kajaib.studio')
    assert.equal(calls, 2)
  })

  test('never caches an unknown verdict', async () => {
    let calls = 0
    const checker = new DisifyEmailReputation(async () => {
      calls += 1
      return jsonResponse({ error: 'unavailable' }, 503)
    })

    await checker.check('runner@gmail.com')
    await checker.check('runner@gmail.com')
    assert.equal(calls, 2)
  })

  test('skips the network for an address without a domain', async () => {
    let calls = 0
    const checker = new DisifyEmailReputation(async () => {
      calls += 1
      return jsonResponse({ disposable: false })
    })
    assert.equal(await checker.check('runner'), null)
    assert.equal(calls, 0)
  })
})
