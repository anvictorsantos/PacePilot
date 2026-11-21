import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { legacyNumericId, providerIdString } from '@/modules/providers/domain/externalId.ts'
import { mapActivity } from '@/modules/providers/infrastructure/providers/strava/mapping.ts'
import { stravaWebhookEventSchema } from '@/modules/providers/infrastructure/schemas/webhook.ts'

describe('provider external ids', () => {
  test('id_str wins over the numeric id', () => {
    assert.equal(providerIdString('9007199254740993', 9007199254740992), '9007199254740993')
    assert.equal(providerIdString(undefined, 123), '123')
    assert.equal(providerIdString(null, null), '')
  })

  test('mapActivity prefers id_str', () => {
    const activity = mapActivity({ id: 123, id_str: '9007199254740993', type: 'Run' })
    assert.equal(activity.externalId, '9007199254740993')
  })

  test('legacy numeric ids only hold safe integers', () => {
    assert.equal(legacyNumericId('12345'), 12345)
    assert.equal(legacyNumericId('9007199254740993'), undefined)
    assert.equal(legacyNumericId('0012'), undefined)
    assert.equal(legacyNumericId('abc'), undefined)
  })

  test('a webhook id that already lost precision is rejected', () => {
    const base = { object_type: 'activity', aspect_type: 'create', event_time: 1 }
    assert.equal(
      stravaWebhookEventSchema.safeParse({
        ...base,
        object_id: 2 ** 60,
        owner_id: 1,
      }).success,
      false,
    )
    assert.equal(
      stravaWebhookEventSchema.safeParse({ ...base, object_id: 123, owner_id: '456' }).success,
      true,
    )
  })
})
