import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import type { CanonicalActivity } from '@/modules/providers/domain/CanonicalActivity.ts'
import type { ConnectionLike } from '@/modules/providers/application/connection.service.ts'
import type { CanonicalWebhookEvent } from '@/modules/providers/domain/Webhook.ts'
import { ingestWebhookEvent } from '@/modules/providers/application/webhook-ingest.service.ts'
import { Sport } from '@/modules/activities/domain/value-object/Sport.ts'

// The push use case runs the same pipeline as the pull import: resolve the athlete,
// fetch the named activity, hand it to the canonical writer. Driven through ports.
const event = (over: Partial<CanonicalWebhookEvent> = {}): CanonicalWebhookEvent => ({
  provider: 'strava',
  objectType: 'activity',
  externalActivityId: '9001',
  externalAthleteId: '4242',
  aspect: 'create',
  subscriptionId: '314159',
  eventTime: new Date('2026-03-01T08:00:00Z'),
  ...over,
})

const canonicalRun = (over: Partial<CanonicalActivity> = {}): CanonicalActivity => ({
  externalId: '9001',
  startedAt: new Date('2026-03-01T08:00:00Z'),
  rawSport: 'Run',
  sport: Sport.Run,
  distanceM: 10000,
  movingTimeS: 3000,
  elapsedTimeS: 3100,
  avgSpeedMps: 3.333,
  maxSpeedMps: null,
  elevationM: 50,
  avgHr: 150,
  maxHr: 175,
  avgCadenceSpm: 170,
  hasHr: true,
  calories: 600,
  achievementCount: 0,
  prCount: 0,
  raw: { id: 9001 },
  ...over,
})

const connection: ConnectionLike = {
  athlete: '5f0b0f0f0f0f0f0f0f0f0f0f',
  provider: 'strava',
  external_athlete_id: '4242',
  access_token: 'ciphertext',
}

interface Calls {
  resolved: Array<[string, string]>
  fetched: Array<[string, string]>
  persisted: Array<{ athleteId: string; providerId: string; items: CanonicalActivity[] }>
}

function deps({
  found = connection as ConnectionLike | null,
  activity = canonicalRun() as CanonicalActivity | null,
  result = { imported: 1, skipped: 0 },
  now = Date.parse('2026-03-01T08:05:00Z'),
} = {}) {
  const calls: Calls = { resolved: [], fetched: [], persisted: [] }
  return {
    calls,
    deps: {
      now: () => now,
      async resolveConnection(providerId: string, externalAthleteId: string) {
        calls.resolved.push([providerId, externalAthleteId])
        return found
      },
      async fetchActivity(providerId: string, _connection: ConnectionLike, externalActivityId: string) {
        calls.fetched.push([providerId, externalActivityId])
        return activity
      },
      async persist(athleteId: string, providerId: string, items: CanonicalActivity[]) {
        calls.persisted.push({ athleteId, providerId, items })
        return result
      },
    },
  }
}

describe('push ingestion', () => {
  test('a create stores through the canonical writer with the provider activity id as the key', async () => {
    const fake = deps()
    const outcome = await ingestWebhookEvent(event(), fake.deps)

    assert.deepEqual(outcome, { status: 'stored', imported: 1, skipped: 0 })
    assert.deepEqual(fake.calls.resolved, [['strava', '4242']])
    assert.deepEqual(fake.calls.fetched, [['strava', '9001']])
    assert.equal(fake.calls.persisted.length, 1)
    assert.equal(fake.calls.persisted[0]?.athleteId, '5f0b0f0f0f0f0f0f0f0f0f0f')
    assert.equal(fake.calls.persisted[0]?.providerId, 'strava')
    assert.equal(fake.calls.persisted[0]?.items[0]?.externalId, '9001')
  })

  test('an update runs the same writer, so the row is corrected rather than duplicated', async () => {
    const fake = deps({ result: { imported: 0, skipped: 1 } })
    const outcome = await ingestWebhookEvent(event({ aspect: 'update' }), fake.deps)

    assert.deepEqual(outcome, { status: 'stored', imported: 0, skipped: 1 })
    assert.equal(fake.calls.persisted.length, 1)
  })

  test('an unknown athlete is ignored without fetching, persisting or throwing', async () => {
    const fake = deps({ found: null })
    const outcome = await ingestWebhookEvent(event(), fake.deps)

    assert.deepEqual(outcome, { status: 'ignored', reason: 'unknown_athlete' })
    assert.equal(fake.calls.fetched.length, 0)
    assert.equal(fake.calls.persisted.length, 0)
  })

  test('non-activity and delete events are ignored before touching the database', async () => {
    const fake = deps()

    assert.deepEqual(await ingestWebhookEvent(event({ objectType: 'athlete' }), fake.deps), {
      status: 'ignored',
      reason: 'unsupported_object',
    })
    assert.deepEqual(await ingestWebhookEvent(event({ aspect: 'delete' }), fake.deps), {
      status: 'ignored',
      reason: 'unsupported_aspect',
    })
    assert.deepEqual(await ingestWebhookEvent(event({ externalActivityId: null }), fake.deps), {
      status: 'ignored',
      reason: 'missing_activity_id',
    })
    assert.equal(fake.calls.resolved.length, 0)
  })

  test('an activity the provider no longer returns is ignored', async () => {
    const fake = deps({ activity: null })
    assert.deepEqual(await ingestWebhookEvent(event(), fake.deps), {
      status: 'ignored',
      reason: 'activity_not_found',
    })
    assert.equal(fake.calls.persisted.length, 0)
  })

  test('a replayed delivery is dropped before any provider call', async () => {
    const fake = deps()
    // The provider retries with the original event_time, so two hours later this
    // envelope is a replay, not a change worth another provider call.
    const outcome = await ingestWebhookEvent(
      event({ eventTime: new Date('2026-03-01T06:00:00Z') }),
      fake.deps,
    )
    assert.deepEqual(outcome, { status: 'ignored', reason: 'stale_event_time' })
    assert.equal(fake.calls.resolved.length, 0)
    assert.equal(fake.calls.fetched.length, 0)
  })

  test('a delivery from the future beyond clock skew is dropped', async () => {
    const fake = deps()
    const outcome = await ingestWebhookEvent(
      event({ eventTime: new Date('2026-03-01T09:00:00Z') }),
      fake.deps,
    )
    assert.deepEqual(outcome, { status: 'ignored', reason: 'stale_event_time' })
    assert.equal(fake.calls.fetched.length, 0)
  })

  test('a provider that sends no event time is still ingested', async () => {
    const fake = deps()
    const outcome = await ingestWebhookEvent(event({ eventTime: null }), fake.deps)
    assert.equal(outcome.status, 'stored')
  })
})
