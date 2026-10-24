// The AI week cache: one payload per athlete-week-locale-model, invalidated per
// athlete. Pure, no provider, no database.
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  aiCacheKey,
  cacheGet,
  cacheSet,
  clearAiCache,
  clearAiCacheForAthlete,
} from '@/modules/ai/application/quota-cache.ts'
import type { AiWeekPayload } from '@/modules/ai/domain/coaching-contract.ts'

const KEY = aiCacheKey({
  athleteId: 'athlete-1',
  weekKey: '2026-10-26',
  locale: 'pt',
  model: 'model:free',
})

function payload(over: Partial<AiWeekPayload> = {}): AiWeekPayload {
  return {
    week: [
      {
        date: '2026-10-26',
        aiExplanation: 'corrida fácil para abrir a semana',
        aiSuggestedType: null,
        aiSuggestionReason: null,
      },
    ],
    suggestions: [],
    model: 'model:free',
    cached: false,
    confidence: 0.8,
    degraded: null,
    ...over,
  }
}

describe('aiCacheKey', () => {
  test('uses all four segments, so a hit can only match the same generation', () => {
    const base = { athleteId: 'a', weekKey: '2026-10-26', locale: 'pt' as const, model: 'm:free' }
    assert.equal(aiCacheKey(base), 'a:2026-10-26:pt:m:free')
    assert.notEqual(aiCacheKey(base), aiCacheKey({ ...base, athleteId: 'b' }))
    assert.notEqual(aiCacheKey(base), aiCacheKey({ ...base, weekKey: '2026-11-02' }))
    assert.notEqual(aiCacheKey(base), aiCacheKey({ ...base, locale: 'en' }))
    assert.notEqual(aiCacheKey(base), aiCacheKey({ ...base, model: 'other:free' }))
  })
})

describe('cacheSet / cacheGet', () => {
  beforeEach(() => clearAiCache())

  test('a stored body is returned marked as a hit, and the input is not mutated', () => {
    const body = payload()
    cacheSet(KEY, body)

    const hit = cacheGet(KEY)
    assert.ok(hit)
    assert.equal(hit.cached, true)
    assert.equal(hit.week.length, 1)
    assert.equal(body.cached, false, 'the caller-owned body must not be rewritten')
  })

  test('a miss is null', () => {
    assert.equal(cacheGet(KEY), null)
  })

  test('locale and model are part of the identity', () => {
    cacheSet(KEY, payload())
    assert.equal(
      cacheGet(aiCacheKey({ athleteId: 'athlete-1', weekKey: '2026-10-26', locale: 'en', model: 'model:free' })),
      null,
    )
  })

  test('clearAiCache empties everything', () => {
    cacheSet(KEY, payload())
    cacheSet(aiCacheKey({ athleteId: 'athlete-2', weekKey: '2026-10-26', locale: 'pt', model: 'model:free' }), payload())
    clearAiCache()
    assert.equal(cacheGet(KEY), null)
  })
})

describe('clearAiCacheForAthlete', () => {
  beforeEach(() => clearAiCache())

  test('drops one athlete across every locale and week, leaves the rest', () => {
    const other = aiCacheKey({ athleteId: 'athlete-2', weekKey: '2026-10-26', locale: 'pt', model: 'model:free' })
    cacheSet(KEY, payload())
    cacheSet(aiCacheKey({ athleteId: 'athlete-1', weekKey: '2026-10-26', locale: 'en', model: 'model:free' }), payload())
    cacheSet(other, payload())

    clearAiCacheForAthlete('athlete-1')

    assert.equal(cacheGet(KEY), null)
    assert.equal(cacheGet(aiCacheKey({ athleteId: 'athlete-1', weekKey: '2026-10-26', locale: 'en', model: 'model:free' })), null)
    assert.equal(cacheGet(other)?.cached, true, 'another athlete paid for nothing')
  })
})
