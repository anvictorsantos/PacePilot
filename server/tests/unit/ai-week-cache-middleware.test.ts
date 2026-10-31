import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { NextFunction, Request, Response } from 'express'

import { aiWeekCacheHit } from '@/modules/training/infrastructure/routes/plan.routes.ts'
import {
  aiCacheKey,
  cacheSet,
  clearAiCache,
} from '@/modules/ai/application/quota-cache.ts'
import { aiModel } from '@/modules/ai/application/training-ai.service.ts'
import { currentWeekKey } from '@/modules/training/application/plan.service.ts'
import type { AiWeekPayload } from '@/modules/ai/domain/coaching-contract.ts'

const SESSION_SLOT = Symbol.for('pacepilot.session')

const BODY: AiWeekPayload = {
  week: [{
    date: currentWeekKey(),
    aiExplanation: 'prose do cache',
    aiSuggestedType: null,
    aiSuggestionReason: null,
  }],
  suggestions: [],
  model: aiModel,
  cached: false,
  confidence: 0.9,
  degraded: null,
}

// Session already resolved, so `getSession` answers from the request slot, not the database.
function fakeReq(athleteId: string | null, locale = 'pt') {
  const req = {
    query: { locale },
    cookies: {},
    session: { payload: { athleteId }, athlete: null, athleteId, revoked: false },
    [SESSION_SLOT]: { payload: { athleteId }, athlete: null, athleteId, revoked: false },
  }
  return req as unknown as Request
}

function fakeRes() {
  let body: unknown = null
  const res = {
    locals: {} as Record<string, unknown>,
    json(value: unknown) { body = value; return res },
    status() { return res },
    get body() { return body },
  }
  return res as unknown as Response & { locals: Record<string, unknown>; body: unknown }
}

describe('aiWeekCacheHit', () => {
  beforeEach(() => clearAiCache())

  test('a primed key answers 200 with cached:true and never calls next()', async () => {
    const req = fakeReq('athlete-1')
    const res = fakeRes()
    let nextCalls = 0
    cacheSet(
      aiCacheKey({ athleteId: 'athlete-1', weekKey: currentWeekKey(), locale: 'pt', model: aiModel }),
      BODY,
    )

    await aiWeekCacheHit(req, res, (() => { nextCalls++ }) as NextFunction)

    assert.equal(nextCalls, 0, 'the handler (planWeek + provider) must not run')
    assert.ok(res.body, 'a cached body must be written')
    assert.equal((res.body as AiWeekPayload).cached, true)
    assert.equal((res.body as AiWeekPayload).week[0]?.aiExplanation, 'prose do cache')
  })

  test('a miss falls through and stores the key for the handler', async () => {
    const req = fakeReq('athlete-1')
    const res = fakeRes()
    let nextCalls = 0

    await aiWeekCacheHit(req, res, (() => { nextCalls++ }) as NextFunction)

    assert.equal(nextCalls, 1)
    assert.equal(res.body, null)
    assert.equal(
      res.locals.aiWeekKey,
      aiCacheKey({ athleteId: 'athlete-1', weekKey: currentWeekKey(), locale: 'pt', model: aiModel }),
    )
  })

  test('the locale is part of the lookup: an en request misses a pt entry', async () => {
    cacheSet(
      aiCacheKey({ athleteId: 'athlete-1', weekKey: currentWeekKey(), locale: 'pt', model: aiModel }),
      BODY,
    )
    const res = fakeRes()
    let nextCalls = 0

    await aiWeekCacheHit(fakeReq('athlete-1', 'en'), res, (() => { nextCalls++ }) as NextFunction)

    assert.equal(nextCalls, 1)
    assert.equal(res.body, null)
  })

  test('no athlete identity falls through to the handler, which owns the 401', async () => {
    const res = fakeRes()
    let nextCalls = 0

    await aiWeekCacheHit(fakeReq(null), res, (() => { nextCalls++ }) as NextFunction)

    assert.equal(nextCalls, 1)
    assert.equal(res.locals.aiWeekKey, undefined)
  })
})
