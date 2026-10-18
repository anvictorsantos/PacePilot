import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// The session service reads its secret from config at import time, so the test
// environment must be primed before anything under src/ is imported.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000001'

const {
  signToken,
  verifyToken,
  extractToken,
  resolveSession,
  getSession,
  sessionMaxAgeMs,
  isSessionRevoked,
} = await import('@/modules/athlete/application/session.service.ts')
const { AppError, isAppError, serviceUnavailable } = await import('@/modules/shared/infrastructure/errors/AppError.ts')

const req = (over = {}) => ({ cookies: {}, headers: {}, ...over })

describe('extractToken', () => {
  test('prefers the cookie over the header', () => {
    assert.equal(extractToken(req({ cookies: { token: 'from-cookie' }, headers: { authorization: 'Bearer from-header' } })), 'from-cookie')
  })

  test('reads a Bearer header when no cookie is present', () => {
    assert.equal(extractToken(req({ headers: { authorization: 'Bearer abc' } })), 'abc')
  })

  test('is case-insensitive on the Bearer scheme', () => {
    assert.equal(extractToken(req({ headers: { authorization: 'bearer abc' } })), 'abc')
  })

  test('returns null when nothing is present', () => {
    assert.equal(extractToken(req()), null)
    assert.equal(extractToken(undefined), null)
  })

  test('handles a header with no scheme', () => {
    assert.equal(extractToken(req({ headers: { authorization: 'abc' } })), 'abc')
  })

  test('ignores an empty or whitespace-only cookie and falls through', () => {
    assert.equal(extractToken(req({ cookies: { token: '   ' }, headers: { authorization: 'Bearer real' } })), 'real')
  })
})

describe('verifyToken', () => {
  test('round-trips a payload', () => {
    const token = signToken({ athleteId: 'abc', tv: 3 })
    assert.equal(verifyToken(token).athleteId, 'abc')
  })

  test('returns null for garbage rather than throwing', () => {
    assert.equal(verifyToken('not-a-jwt'), null)
    assert.equal(verifyToken(null), null)
  })

  test('rejects a token signed with a different secret', async () => {
    // env is frozen at import time, so the foreign token must be signed here
    // with the real jwt library rather than by swapping process.env.
    const jwt = (await import('jsonwebtoken')).default
    const forged = jwt.sign({ athleteId: 'abc' }, 'a-completely-different-secret')
    assert.equal(verifyToken(forged), null)
  })

  test('rejects a token whose payload has been tampered with', async () => {
    const token = signToken({ athleteId: 'abc', tv: 0 })
    const [header, , signature] = token.split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ athleteId: 'abc', tv: 9 })).toString('base64url')
    const tampered = `${header}.${forgedPayload}.${signature}`
    assert.equal(verifyToken(tampered), null)
  })
})

describe('sessionMaxAgeMs', () => {
  test('parses jsonwebtoken-style durations', () => {
    assert.equal(sessionMaxAgeMs(), 24 * 3600000) // default 24h
  })
})

describe('isSessionRevoked', () => {
  test('fails open without a database, as the data routes require one anyway', async () => {
    assert.equal(await isSessionRevoked({ athleteId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }), false)
  })

  test('treats a payload with no athlete as not revoked', async () => {
    assert.equal(await isSessionRevoked({}), false)
    assert.equal(await isSessionRevoked(null), false)
  })
})

describe('resolveSession', () => {
  test('reports no session for an anonymous request', async () => {
    const s = await resolveSession(req())
    assert.equal(s.payload, null)
    assert.equal(s.athlete, null)
    assert.equal(s.athleteId, null)
    assert.equal(s.revoked, false)
  })

  test('reports no session for an invalid token', async () => {
    const s = await resolveSession(req({ cookies: { token: 'garbage' } }))
    assert.equal(s.payload, null)
  })

  test('keeps the token id usable while the database is down', async () => {
    // The row cannot be read, but `athlete: id` query filters must still work —
    // the id is the token's, not the document's.
    const id = 'aaaaaaaaaaaaaaaaaaaaaaaa'
    const token = signToken({ athleteId: id, tv: 0 })
    const s = await resolveSession(req({ cookies: { token } }))
    assert.equal(s.athleteId, id)
    assert.equal(s.athlete, null)
    assert.equal(s.revoked, false)
  })

  test('caches one resolution per request', async () => {
    const request = req({ cookies: { token: signToken({ athleteId: 'abc', tv: 0 }) } })
    const first = await getSession(request)
    const second = await getSession(request)
    assert.equal(first, second)
  })
})

describe('Express adapter', () => {
  test('re-exports the helpers its callers import from it', async () => {
    const adapter = await import('@/modules/shared/infrastructure/http/auth.ts')
    assert.equal(adapter.signToken, signToken)
    assert.equal(adapter.sessionMaxAgeMs, sessionMaxAgeMs)
    assert.equal(typeof adapter.sessionCookieOptions, 'function')
    assert.equal(typeof adapter.requireAuthForUserData, 'function')
    assert.equal(typeof adapter.requireSameOrigin, 'function')
  })
})

describe('AppError', () => {
  test('carries status and exposure', () => {
    const err = serviceUnavailable('Database not connected')
    assert.equal(err.status, 503)
    // 5xx messages never reach the client: errorHandler answers a server fault
    // with a flat "Internal server error" whatever `expose` says. This assertion
    // used to read `true`, contradicting the same case in review-fixes.test.ts
    // and the errorHandler contract that test locks in.
    assert.equal(err.expose, false)
    assert.equal(isAppError(err), true)
  })

  test('defaults to an unexposed 500', () => {
    const err = new AppError('internal detail')
    assert.equal(err.status, 500)
    assert.equal(err.expose, false)
  })

  test('preserves the cause chain', () => {
    const cause = new Error('root')
    assert.equal(new AppError('wrapped', { cause }).cause, cause)
  })
})