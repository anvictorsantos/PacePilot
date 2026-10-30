/**
 * A provider's push delivery in canonical terms. The provider adapter verifies
 * and translates its own wire format into this shape; nothing above it reads
 * `hub.mode`, `aspect_type` or an owner id.
 */
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
  /** Which subscription delivered this, when the provider says. */
  subscriptionId: string | null
  eventTime: Date | null
}

/**
 * Answer to the one-off subscription handshake. `unconfigured` is a deployment
 * state (no verify token yet), never an unverified acceptance.
 */
export type WebhookHandshake =
  | { status: 'verified'; challenge: string }
  | { status: 'unconfigured' }
  | { status: 'rejected' }

/** Whether a delivery belongs to this deployment's configured subscription. */
export type WebhookAuthorisation = 'authorised' | 'unconfigured' | 'rejected'

/**
 * Deliveries are tiny envelopes. The general API accepts 100 kB; a push body
 * that needs more than this is not a delivery and must not be buffered.
 */
export const WEBHOOK_MAX_BODY_BYTES = 8 * 1024

/**
 * How stale a delivery may be and still be acted on. A provider retries with the
 * original `event_time`, so a replay is indistinguishable from a retry by shape
 * alone — only its age tells them apart. One hour is generous for a retry and
 * tight enough that a replayed envelope cannot keep spending provider quota; a
 * genuinely late change is still picked up by the pull sync's overlap window.
 */
export const WEBHOOK_EVENT_MAX_AGE_MS = 60 * 60 * 1000
/** Clock skew between the provider and this host is not a replay. */
export const WEBHOOK_EVENT_FUTURE_SKEW_MS = 5 * 60 * 1000

/**
 * Whether a delivery's event time is plausible enough to act on. A provider that
 * sends no timestamp is accepted: there is nothing to judge, and the envelope
 * still had to pass the subscription check.
 */
export function isDeliverableEventTime(
  eventTime: Date | null,
  now: Date,
  { maxAgeMs = WEBHOOK_EVENT_MAX_AGE_MS }: { maxAgeMs?: number } = {},
): boolean {
  if (!eventTime) return true
  const age = now.getTime() - eventTime.getTime()
  return age <= maxAgeMs && age >= -WEBHOOK_EVENT_FUTURE_SKEW_MS
}
