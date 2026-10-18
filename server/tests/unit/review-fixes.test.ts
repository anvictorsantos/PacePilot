import { test, describe, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

const calls = { post: [], get: [] }
let postImpl = async () => ({ data: {} })
let getImpl = async () => ({ data: { id: 'a1', firstname: 'T', lastname: 'R' } })

before(async () => {
  const axios = (await import('axios')).default
  axios.post = async (url, body, config) => { calls.post.push({ url, body, config }); return postImpl(url, body, config) }
  axios.get = async (url, config) => { calls.get.push({ url, config }); return getImpl(url, config) }
})

import { env } from '@/modules/shared/infrastructure/config/env.ts'
import {
  encryptToken,
  decryptToken,
} from '@/modules/shared/infrastructure/utils/tokenCrypto.ts'
import { parsePagination } from '@/modules/shared/infrastructure/utils/pagination.ts'
import { AppError, badRequest, isAppError, serviceUnavailable } from '@/modules/shared/infrastructure/errors/AppError.ts'
import { errorHandler, notFound } from '@/modules/shared/infrastructure/http/errorHandler.ts'
import { classifyActivity, normalizeActivity } from '@/modules/activities/application/activity.service.ts'

const KEY = 'a'.repeat(64)

// ---------------------------------------------------------------- AppError ---
describe('AppError', () => {
  test('carries status and exposure', () => {
    const err = serviceUnavailable('Database not connected')
    assert.equal(err.status, 503)
    assert.equal(err.expose, false, '5xx must never reach the client')
    assert.equal(isAppError(err), true)
  })

  test('defaults to an unexposed 500', () => {
    const err = new AppError('internal detail')
    assert.equal(err.status, 500)
    assert.equal(err.expose, false)
  })

  test('4xx is exposable by default', () => {
    assert.equal(badRequest('nope').expose, true)
  })

  test('preserves the cause chain', () => {
    const cause = new Error('root')
    assert.equal(new AppError('wrapped', { cause }).cause, cause)
  })

  test('is a real Error', () => {
    const err = badRequest('x')
    assert.equal(err instanceof Error, true)
    assert.equal(err.name, 'AppError')
  })
})

// ------------------------------------------------------------ errorHandler ---
function runHandler(err) {
  const res = {
    statusCode: null,
    payload: null,
    headersSent: false,
    ended: false,
    status(code) { this.statusCode = code; return this },
    json(body) { this.payload = body; return this },
    end() { this.ended = true; return this },
  }
  errorHandler(err, {}, res, () => {})
  return res
}

describe('errorHandler', () => {
  let logged
  const realError = console.error
  beforeEach(() => { logged = []; console.error = (...a) => logged.push(a) })
  after(() => { console.error = realError })

  test('never leaks a 5xx message to the client', () => {
    const res = runHandler(new AppError('mongodb://user:pass@host/db timed out', { status: 500 }))
    assert.equal(res.statusCode, 500)
    assert.equal(res.payload.error, 'Internal server error')
    assert.equal(JSON.stringify(res.payload).includes('mongodb'), false)
  })

  test('surfaces an exposable 4xx message', () => {
    const res = runHandler(badRequest('Invalid goal'))
    assert.equal(res.statusCode, 400)
    assert.equal(res.payload.error, 'Invalid goal')
  })

  test('scrubs secrets out of a 4xx message', () => {
    const res = runHandler(badRequest('failed with access_token=sk-or-v1-abcdef123456'))
    assert.equal(res.payload.error.includes('sk-or-v1-abcdef123456'), false)
    assert.match(res.payload.error, /REDACTED/)
  })

  test('caps a long 4xx message', () => {
    const res = runHandler(badRequest('x'.repeat(5000)))
    assert.ok(res.payload.error.length <= 300)
  })

  test('maps the CORS denial to 403 without a status on the error', () => {
    const res = runHandler(new Error('CORS origin denied'))
    assert.equal(res.statusCode, 403)
  })

  test('honours a numeric status on a plain Error (legacy throw sites)', () => {
    const e = new Error('Database not connected')
    e.status = 503
    const res = runHandler(e)
    assert.equal(res.statusCode, 503)
  })

  test('defaults an unknown error to 500', () => {
    assert.equal(runHandler(new Error('boom')).statusCode, 500)
  })

  test('logs server faults exactly once, with the stack', () => {
    logged.length = 0
    runHandler(new Error('boom'))
    assert.equal(logged.length, 1)
    const line = logged.map(a => a.join(' ')).join('\n')
    assert.match(line, /\[error\] Error: boom/)
    assert.ok(line.includes('Error: boom'), 'the stack must reach the log')
  })

  test('does not log routine client noise', () => {
    logged.length = 0
    const e = new Error('aborted')
    e.code = 'ECONNABORTED'
    runHandler(e)
    assert.equal(logged.length, 0)
  })

  test('does not double-respond when headers are already sent', () => {
    const res = { headersSent: true, status() { throw new Error('must not call status') }, json() { throw new Error('must not json') }, end() { this.ended = true } }
    errorHandler(new Error('late failure'), {}, res, () => {})
    assert.equal(res.ended, true)
  })

  test('notFound answers 404 with a stable shape', () => {
    const res = { statusCode: null, payload: null, status(c) { this.statusCode = c; return this }, json(b) { this.payload = b; return this } }
    notFound({}, res)
    assert.equal(res.statusCode, 404)
    assert.deepEqual(res.payload, { error: 'Not found' })
  })
})

// --------------------------------------------------------------- pagination ---
describe('parsePagination', () => {
  test('defaults', () => {
    assert.deepEqual(parsePagination({}), { page: 1, perPage: 20, skip: 0, limit: 20 })
  })

  test('honours a caller-supplied perPage default', () => {
    // Regression: a hard-coded fallback of 20 discarded defaults.perPage.
    assert.deepEqual(parsePagination({}, { page: 1, perPage: 50 }).perPage, 50)
  })

  test('falls back to the default when the query value is unparseable', () => {
    assert.equal(parsePagination({ per_page: 'abc' }, { page: 1, perPage: 50 }).perPage, 50)
    assert.equal(parsePagination({ per_page: '' }, { page: 1, perPage: 50 }).perPage, 50)
  })

  test('accepts camelCase and snake_case', () => {
    assert.equal(parsePagination({ per_page: '10' }).perPage, 10)
    assert.equal(parsePagination({ perPage: '12' }).perPage, 12)
  })

  test('caps per_page at 100 and floors at 1', () => {
    assert.equal(parsePagination({ per_page: '9999' }).perPage, 100)
    assert.equal(parsePagination({ per_page: '0' }).perPage, 20)
    assert.equal(parsePagination({ per_page: '-5' }).perPage, 20)
  })

  test('computes skip from page', () => {
    assert.deepEqual(parsePagination({ page: '3', per_page: '10' }), { page: 3, perPage: 10, skip: 20, limit: 10 })
  })

  test('tolerates a missing query object', () => {
    assert.equal(parsePagination(undefined).page, 1)
  })
})

// ------------------------------------------------------------------ crypto ---
describe('tokenCrypto', () => {
  test('round-trips an encrypted token', () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = KEY
    try {
      const enc = encryptToken('strava-secret-token')
      assert.notEqual(enc, 'strava-secret-token')
      assert.ok(enc.startsWith('enc:v1:'))
      assert.equal(decryptToken(enc), 'strava-secret-token')
    } finally { process.env.TOKEN_ENCRYPTION_KEY = saved }
  })

  test('is idempotent on already-encrypted input', () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = KEY
    try {
      const once = encryptToken('t')
      assert.equal(encryptToken(once), once)
    } finally { process.env.TOKEN_ENCRYPTION_KEY = saved }
  })

  test('passes through plaintext when no key is configured', () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = ''
    try {
      assert.equal(encryptToken('plain'), 'plain')
      assert.equal(decryptToken('plain'), 'plain')
    } finally { process.env.TOKEN_ENCRYPTION_KEY = saved }
  })

  test('passes through non-strings untouched', () => {
    assert.equal(decryptToken(null), null)
    assert.equal(encryptToken(undefined), undefined)
  })
})

// -------------------------------------------------------------- classifier ---
describe('classifyActivity', () => {
  test('very short runs are recovery', () => {
    assert.equal(classifyActivity({ distance_km: 1, moving_time_min: 10 }), 'recovery')
  })

  test('long runs are detected by distance or duration', () => {
    assert.equal(classifyActivity({ distance_km: 18, moving_time_min: 95 }), 'long')
    assert.equal(classifyActivity({ distance_km: 12, moving_time_min: 90 }), 'long')
  })

  test('classifies by pace relative to the athlete baseline', () => {
    // Baseline 330 s/km. ratio = this run's pace / baseline; lower = faster
    // than the athlete usually runs.
    const BASE = 330
    const run = pace => ({ distance_km: 10, moving_time_min: 50, avg_pace_sec_km: pace })
    assert.equal(classifyActivity(run(290), BASE), 'threshold') // 0.88 → much faster, long enough
    assert.equal(classifyActivity(run(305), BASE), 'steady')    // 0.92 → the steady band
    assert.equal(classifyActivity(run(330), BASE), 'easy')      // 1.00 → baseline effort
    assert.equal(classifyActivity(run(370), BASE), 'recovery')  // 1.12 → slower than usual
  })

  test('a pace well under the baseline earns a hard label when long enough', () => {
    const long = { distance_km: 10, moving_time_min: 50, avg_pace_sec_km: 250 }
    assert.equal(classifyActivity(long, 300), 'threshold') // 0.83, d>=8 and t>=40
    const short = { distance_km: 4, moving_time_min: 20, avg_pace_sec_km: 250 }
    assert.equal(classifyActivity(short, 300), 'interval') // 0.83 but too short for threshold
  })

  test('without a baseline it refuses to guess too precisely', () => {
    assert.equal(classifyActivity({ distance_km: 3, moving_time_min: 20 }), 'unknown')
  })

  test('the lap-based interval branch is reachable', () => {
    // laps are always [] in normalizeActivity, so this branch never fired in
    // production. Asserted here so the behaviour is documented rather than dead.
    const withLaps = { distance_km: 7, moving_time_min: 32, avg_pace_sec_km: 300, laps: new Array(8).fill(0) }
    assert.equal(classifyActivity(withLaps, 300), 'interval')
  })

  test('normalizeActivity produces a complete shape', () => {
    const n = normalizeActivity({ id: 1, distance: 10000, moving_time: 3000, start_date: '2026-01-01T08:00:00Z', average_speed: 3.33 })
    assert.equal(n.strava_activity_id, 1)
    assert.equal(n.distance_km, 10)
    assert.ok(n.avg_pace_sec_km > 0)
    assert.equal(n.date instanceof Date, true)
  })
})
