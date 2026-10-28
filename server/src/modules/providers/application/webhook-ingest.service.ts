/**
 * Push ingestion — the provider tells us an activity exists, we read that one
 * canonical record and hand it to the same writer the pull import uses. No
 * classification, normalisation or idempotency rule is duplicated here: the
 * writer keys on `{provider, provider activity id}`, so a push and a later pull
 * that both see the activity update one row.
 */
import mongoose from 'mongoose'

import type { CanonicalActivity } from '@/modules/providers/domain/CanonicalActivity.ts'
import type { CanonicalWebhookEvent } from '@/modules/providers/domain/Webhook.ts'
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
 * Ignore what is not ours to store and answer 200 to the provider: an unknown
 * athlete must never become a retry loop. Only a configured subscription gets
 * this far, so the caller is the provider, not an anonymous internet client.
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

  const connection = await deps.resolveConnection(event.provider, event.externalAthleteId)
  if (!connection?.athlete) return { status: 'ignored', reason: 'unknown_athlete' }
  const athleteId = String(connection.athlete)
  if (!mongoose.isValidObjectId(athleteId)) {
    return { status: 'ignored', reason: 'unknown_athlete' }
  }

  // The envelope names the activity; the canonical record still comes from the
  // provider, so the domain never stores a half-invented activity.
  const activity = await deps.fetchActivity(
    event.provider,
    connection,
    event.externalActivityId,
  )
  if (!activity) return { status: 'ignored', reason: 'activity_not_found' }

  const { imported, skipped } = await deps.persist(athleteId, event.provider, [activity])
  return { status: 'stored', imported, skipped }
}
