import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  createEmailToken,
  hashEmailToken,
} from '@/modules/auth/domain/email-token.ts'
import { renderEmail } from '@/modules/auth/infrastructure/email/templates.ts'
import { emailLocaleFrom } from '@/modules/auth/domain/email-sender.ts'

describe('email tokens', () => {
  test('are random and hash to a stable digest', () => {
    const a = createEmailToken(PASSWORD_RESET_TTL_MS)
    const b = createEmailToken(PASSWORD_RESET_TTL_MS)
    assert.notEqual(a.token, b.token)
    assert.equal(hashEmailToken(a.token), a.hash)
    assert.match(a.hash, /^[a-f0-9]{64}$/)
  })

  test('carry their own expiry', () => {
    const now = Date.UTC(2026, 9, 24, 12, 0, 0)
    const verify = createEmailToken(EMAIL_VERIFICATION_TTL_MS, now)
    const reset = createEmailToken(PASSWORD_RESET_TTL_MS, now)
    assert.equal(verify.expiresAt.getTime(), now + 24 * 60 * 60 * 1000)
    assert.equal(reset.expiresAt.getTime(), now + 30 * 60 * 1000)
  })
})

describe('email locale', () => {
  test('reads the browser Accept-Language header', () => {
    assert.equal(emailLocaleFrom('pt-PT,pt;q=0.9,en;q=0.8'), 'pt')
    assert.equal(emailLocaleFrom('en-GB,en;q=0.9'), 'en')
    assert.equal(emailLocaleFrom(undefined), 'en')
    assert.equal(emailLocaleFrom(['pt-BR']), 'pt')
  })
})

describe('email templates', () => {
  test('verification email carries the action link and palette', () => {
    const url = 'https://pacepilot.app/verify-email?token=abc123'
    const mail = renderEmail('verification', 'en', url, 'runner@example.com')
    assert.match(mail.subject, /verify/i)
    assert.ok(mail.html.includes(url))
    assert.ok(mail.html.includes('#F97316'))
    assert.ok(mail.html.includes('runner@example.com'))
    assert.ok(mail.text.includes(url))
    assert.ok(mail.text.includes('24 hours'))
  })

  test('reset email states the 30-minute expiry in Portuguese', () => {
    const url = 'https://pacepilot.app/reset-password?token=abc123'
    const mail = renderEmail('reset', 'pt', url, 'corredor@example.com')
    assert.match(mail.subject, /palavra-passe/i)
    assert.ok(mail.html.includes(url))
    assert.ok(mail.html.includes('30 minutos'))
    assert.ok(mail.text.includes(url))
  })

  test('escapes athlete-supplied text in the body', () => {
    const mail = renderEmail('reset', 'en', 'https://x.test/?token=1', '<script>x</script>@example.com')
    assert.equal(mail.html.includes('<script>x</script>'), false)
    assert.ok(mail.html.includes('&lt;script&gt;x&lt;/script&gt;'))
  })
})
