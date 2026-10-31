// A provider's push delivery in canonical terms: the adapter verifies and
// translates its own wire format here; nothing above it reads `hub.mode`.
export type WebhookObjectType = 'activity' | 'athlete' | 'other'
export type WebhookAspect = 'create' | 'update' | 'delete' | 'other'

export interface CanonicalWebhookEvent {
  provider: string
  objectType: WebhookObjectType
  /** The provider's activity id — the same key the pull import writes under. */
  externalActivityId: string | null
  /** The provider's athlete id; deliveries never carry our athlete id. */
  externalAthleteId: string
  aspect: WebhookAspect
  subscriptionId: string | null
  eventTime: Date | null
}

/**
 * `unconfigured` is a deployment state (no verify token yet), never an
 * unverified acceptance.
 */
export type WebhookHandshake =
  | { status: 'verified'; challenge: string }
  | { status: 'unconfigured' }
  | { status: 'rejected' }

export type WebhookAuthorisation = 'authorised' | 'unconfigured' | 'rejected'

// Deliveries are tiny envelopes: a body past this is not a delivery and must
// not be buffered, against the general API's 100 kB.
export const WEBHOOK_MAX_BODY_BYTES = 8 * 1024

// A provider retries with the original `event_time`, so only a delivery's age
// tells a replay from a retry: one hour, and the pull overlap covers late changes.
export const WEBHOOK_EVENT_MAX_AGE_MS = 60 * 60 * 1000
/** Clock skew between the provider and this host is not a replay. */
export const WEBHOOK_EVENT_FUTURE_SKEW_MS = 5 * 60 * 1000

// A provider that sends no timestamp is accepted: there is nothing to judge.
export function isDeliverableEventTime(
  eventTime: Date | null,
  now: Date,
  { maxAgeMs = WEBHOOK_EVENT_MAX_AGE_MS }: { maxAgeMs?: number } = {},
): boolean {
  if (!eventTime) return true
  const age = now.getTime() - eventTime.getTime()
  return age <= maxAgeMs && age >= -WEBHOOK_EVENT_FUTURE_SKEW_MS
}
