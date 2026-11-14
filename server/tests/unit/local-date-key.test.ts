import test from 'node:test'
import assert from 'node:assert/strict'

// Each test file runs in its own process, so this cannot leak into another suite.
process.env.TZ = 'America/Sao_Paulo'

import {
  localDateFromKey,
  localDateStr,
} from '@/modules/training/domain/adaptive.ts'

test('a feedback day key is the local day it names', () => {
  const d = localDateFromKey('2026-11-14')
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 10)
  assert.equal(d.getDate(), 14)
  assert.equal(localDateStr(d), '2026-11-14')
})

test('UTC midnight is the previous local day west of UTC — the bug this replaces', () => {
  // The old `new Date(key)` stored UTC midnight, which reads back as the day before.
  assert.equal(localDateStr(new Date('2026-11-14')), '2026-11-13')
  assert.equal(localDateStr(localDateFromKey('2026-11-14')), '2026-11-14')
})
