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
