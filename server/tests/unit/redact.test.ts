import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { redactSecrets } from '../../src/utils/redact.ts'

describe('redactSecrets', () => {
  test('passes through null and undefined', () => {
    assert.equal(redactSecrets(null), null)
    assert.equal(redactSecrets(undefined), undefined)
  })

  test('scrubs bearer tokens', () => {
    assert.equal(
      redactSecrets('Authorization: Bearer abc.def-ghi_jkl'),
      'Authorization: Bearer [REDACTED]',
    )
  })

  test('scrubs token fields in assignments, JSON and query strings', () => {
    assert.match(redactSecrets('access_token=abc123'), /access_token=\[REDACTED\]/)
    assert.match(redactSecrets('{"refresh_token":"abc123"}'), /refresh_token[":=\s]+\[REDACTED\]/)
  })
})
