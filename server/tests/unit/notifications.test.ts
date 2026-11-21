import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { coachingPreferencesSchema, pushSubscriptionSchema } from '@/modules/athlete/infrastructure/schemas/preferences.ts'
import { paceString, reminderMessage, weeklySummaryEmail } from '@/modules/notifications/domain/messages.ts'
import { hourInZone } from '@/modules/shared/infrastructure/time/timeZone.ts'

describe('coaching preferences', () => {
  it('accepts a partial patch and rejects an unknown locale', () => {
    assert.equal(coachingPreferencesSchema.safeParse({ explanations: false }).success, true)
    assert.equal(coachingPreferencesSchema.safeParse({ locale: 'pt' }).success, true)
    assert.equal(coachingPreferencesSchema.safeParse({ locale: 'fr' }).success, false)
    assert.equal(coachingPreferencesSchema.safeParse({ explanations: 'yes' }).success, false)
  })
})

describe('push subscription schema', () => {
  it('requires a URL endpoint and both keys', () => {
    const valid = {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'key', auth: 'auth' },
    }
    assert.equal(pushSubscriptionSchema.safeParse(valid).success, true)
    assert.equal(
      pushSubscriptionSchema.safeParse({ ...valid, endpoint: 'not-a-url' }).success,
      false,
    )
    assert.equal(
      pushSubscriptionSchema.safeParse({ endpoint: valid.endpoint, keys: { p256dh: '' } }).success,
      false,
    )
  })
})

describe('notification copy', () => {
  it('localizes the reminder and names the workout', () => {
    assert.deepEqual(reminderMessage('en', 'tempo'), {
      title: "Today's session",
      body: 'Tempo run is on the plan today.',
    })
    assert.deepEqual(reminderMessage('pt', 'long'), {
      title: 'Sessão de hoje',
      body: 'Corrida longa está no plano para hoje.',
    })
  })

  it('formats the weekly summary and pace', () => {
    const en = weeklySummaryEmail('en', { runs: 4, distanceKm: 42, avgPace: '5:41' })
    assert.equal(en.subject, 'Your training week')
    assert.match(en.text, /4 runs · 42\.0 km · average pace 5:41/)
    const pt = weeklySummaryEmail('pt', { runs: 4, distanceKm: 42, avgPace: null })
    assert.match(pt.text, /4 corridas · 42\.0 km/)
    assert.equal(paceString(341), '5:41')
    assert.equal(paceString(null), null)
  })

  it('reads the hour in the athlete zone', () => {
    const at = new Date('2026-11-22T07:30:00Z')
    assert.equal(hourInZone(at, 'UTC'), 7)
    assert.equal(hourInZone(at, 'Europe/Lisbon'), 7)
    assert.equal(hourInZone(at, 'America/New_York'), 2)
  })
})

describe('notification windows', () => {
  it('sends only inside the local window and once per day', async () => {
    const { dueOn, reminderWindow, summaryWindow } = await import(
      '@/modules/notifications/domain/schedule.ts'
    )
    assert.equal(reminderWindow(6), false)
    assert.equal(reminderWindow(7), true)
    assert.equal(reminderWindow(9), true)
    assert.equal(reminderWindow(10), false)
    assert.equal(summaryWindow(17), false)
    assert.equal(summaryWindow(18), true)
    assert.equal(summaryWindow(21), true)
    assert.equal(summaryWindow(22), false)
    assert.equal(dueOn('2026-11-22', '2026-11-22'), false)
    assert.equal(dueOn('2026-11-21', '2026-11-22'), true)
    assert.equal(dueOn(null, '2026-11-22'), true)
  })
})
