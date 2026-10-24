import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  hashPassword,
  verifyPassword,
} from '@/modules/auth/infrastructure/security/password-hasher.ts'
import {
  isValidEmail,
  isValidPassword,
  normaliseEmail,
  passwordProblem,
} from '@/modules/auth/domain/password-policy.ts'

describe('password hashing', () => {
  test('verifies the password it hashed', async () => {
    const hash = await hashPassword('correct horse battery staple')
    assert.equal(await verifyPassword('correct horse battery staple', hash), true)
  })

  test('rejects a different password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    assert.equal(await verifyPassword('Correct horse battery staple', hash), false)
  })

  test('salts each hash, so equal passwords differ at rest', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    assert.notEqual(a, b)
    assert.equal(await verifyPassword('same-password', a), true)
    assert.equal(await verifyPassword('same-password', b), true)
  })

  test('stores the parameters with the digest', async () => {
    const hash = await hashPassword('same-password')
    assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
  })

  test('malformed or missing hashes fail closed', async () => {
    assert.equal(await verifyPassword('x', null), false)
    assert.equal(await verifyPassword('x', ''), false)
    assert.equal(await verifyPassword('x', 'not-a-hash'), false)
    assert.equal(await verifyPassword('x', 'scrypt$0$0$0$a$b'), false)
  })
})

describe('credential policy', () => {
  test('normalises email before lookup', () => {
    assert.equal(normaliseEmail('  Runner@Example.COM '), 'runner@example.com')
  })

  test('accepts a normal address and rejects a malformed one', () => {
    assert.equal(isValidEmail('runner@example.com'), true)
    assert.equal(isValidEmail('runner@'), false)
    assert.equal(isValidEmail('not an email'), false)
    assert.equal(isValidEmail(''), false)
  })

  test('password bounds are 8 to 128 characters', () => {
    assert.equal(isValidPassword('1234567'), false)
    assert.equal(isValidPassword('12345678'), true)
    assert.equal(isValidPassword('a'.repeat(128)), true)
    assert.equal(isValidPassword('a'.repeat(129)), false)
    assert.match(String(passwordProblem('short')), /at least 8/)
  })
})
