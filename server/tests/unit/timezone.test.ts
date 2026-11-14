import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addDaysToKey,
  dateKeyInZone,
  daysBetweenKeys,
  timeZoneFromHeader,
  weekdayOfKey,
} from '@/modules/shared/infrastructure/time/timeZone.ts'

test('the same instant is a different calendar day east and west of UTC', () => {
  const instant = new Date('2026-11-15T02:00:00Z')
  assert.equal(dateKeyInZone(instant, 'America/Sao_Paulo'), '2026-11-14')
  assert.equal(dateKeyInZone(instant, 'Europe/Lisbon'), '2026-11-15')
  assert.equal(dateKeyInZone(instant, 'Asia/Tokyo'), '2026-11-15')
})

test('day arithmetic is DST-proof', () => {
  // Europe springs forward on 2026-03-29.
  assert.equal(addDaysToKey('2026-03-28', 1), '2026-03-29')
  assert.equal(addDaysToKey('2026-03-29', 1), '2026-03-30')
  assert.equal(addDaysToKey('2026-03-30', -1), '2026-03-29')
  assert.equal(daysBetweenKeys('2026-03-28', '2026-03-30'), 2)
})

test('weekday and day distance match the calendar', () => {
  assert.equal(weekdayOfKey('2026-11-14'), 6) // Saturday
  assert.equal(daysBetweenKeys('2026-11-09', '2026-11-15'), 6)
  assert.ok(Number.isNaN(daysBetweenKeys('nope', '2026-11-15')))
})

test('only a real IANA zone is accepted from the header', () => {
  assert.equal(timeZoneFromHeader('America/Sao_Paulo'), 'America/Sao_Paulo')
  assert.equal(timeZoneFromHeader(' Europe/Lisbon '), 'Europe/Lisbon')
  assert.equal(timeZoneFromHeader('Mars/Olympus'), undefined)
  assert.equal(timeZoneFromHeader(undefined), undefined)
  assert.equal(timeZoneFromHeader(['America/Sao_Paulo']), undefined)
})
