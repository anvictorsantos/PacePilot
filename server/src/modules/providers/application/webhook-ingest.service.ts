// The provider tells us an activity exists; we read that record and hand it to
// the pull writer, which keys on `{provider, provider activity id}`.
import mongoose from 'mongoose'

import type { CanonicalActivity } from '@/modules/providers/domain/CanonicalActivity.ts'
import {
  isDeliverableEventTime,
  type CanonicalWebhookEvent,
} from '@/modules/providers/domain/Webhook.ts'
import { persistActivities } from '@/modules/providers/application/activity-import.service.ts'
import { getProvider } from '@/modules/providers/application/provider-registry.ts'
import {
  findConnectionByExternalAthlete,
  freshAccessToken,
  type ConnectionLike,
} from '@/modules/providers/application/connection.service.ts'

export type WebhookIgnoredReason =
  | 'unknown_athlete'
  | 'unsupported_object'
  | 'unsupported_aspect'
  | 'missing_activity_id'
  | 'stale_event_time'
  | 'activity_not_found'

export type WebhookIngestOutcome =
  | { status: 'stored'; imported: number; skipped: number }
  | { status: 'ignored'; reason: WebhookIgnoredReason }

/** The seams the route supplies; tests drive the use case through these. */
export interface WebhookIngestDeps {
  resolveConnection(
    providerId: string,
    externalAthleteId: string,
  ): Promise<ConnectionLike | null>
  fetchActivity(
    providerId: string,
    connection: ConnectionLike,
    externalActivityId: string,
  ): Promise<CanonicalActivity | null>
  persist(
    athleteId: string,
    providerId: string,
    items: CanonicalActivity[],
  ): Promise<{ imported: number; skipped: number }>
  now?(): number
}

const defaultDeps: WebhookIngestDeps = {
  resolveConnection: (providerId, externalAthleteId) =>
    findConnectionByExternalAthlete(providerId, externalAthleteId),
  async fetchActivity(providerId, connection, externalActivityId) {
    const provider = getProvider(providerId)
    return provider.getActivity(await freshAccessToken(connection), externalActivityId)
  },
  persist: (athleteId, providerId, items) =>
    persistActivities(new mongoose.Types.ObjectId(athleteId), providerId, items),
}

/**
 * Answer 200 on anything not ours: an unknown athlete must never become a retry
 * loop. Only a configured subscription gets this far.
 */
export async function ingestWebhookEvent(
  event: CanonicalWebhookEvent,
  deps: WebhookIngestDeps = defaultDeps,
): Promise<WebhookIngestOutcome> {
  // Cheap rejections before any database or upstream call.
  if (event.objectType !== 'activity') {
    return { status: 'ignored', reason: 'unsupported_object' }
  }
  if (event.aspect !== 'create' && event.aspect !== 'update') {
    return { status: 'ignored', reason: 'unsupported_aspect' }
  }
  if (!event.externalActivityId) {
    return { status: 'ignored', reason: 'missing_activity_id' }
  }
  // A retried delivery carries the original timestamp, so an old event time is
  // a replay, and accepting it keeps spending provider quota.
  const now = new Date(deps.now ? deps.now() : Date.now())
  if (!isDeliverableEventTime(event.eventTime, now)) {
    return { status: 'ignored', reason: 'stale_event_time' }
  }

  const connection = await deps.resolveConnection(event.provider, event.externalAthleteId)
  if (!connection?.athlete) return { status: 'ignored', reason: 'unknown_athlete' }
  const athleteId = String(connection.athlete)
  if (!mongoose.isValidObjectId(athleteId)) {
    return { status: 'ignored', reason: 'unknown_athlete' }
  }

  // The envelope names the activity; the record still comes from the provider.
  const activity = await deps.fetchActivity(
    event.provider,
    connection,
    event.externalActivityId,
  )
  if (!activity) return { status: 'ignored', reason: 'activity_not_found' }

  const { imported, skipped } = await deps.persist(athleteId, event.provider, [activity])
  return { status: 'stored', imported, skipped }
}
