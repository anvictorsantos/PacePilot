import { z } from 'zod'

/**
 * Strava's push wire shapes, validated at the boundary before any mapping runs.
 * The event is a small envelope — it names an activity but carries no activity
 * data, so the push path still reads the canonical record from the provider.
 */
const externalId = z.union([z.number().int().nonnegative(), z.string().min(1).max(64)])

export const stravaWebhookEventSchema = z
  .object({
    object_type: z.string().min(1).max(32),
    object_id: externalId,
    aspect_type: z.string().min(1).max(32),
    owner_id: externalId,
    subscription_id: externalId.optional(),
    event_time: z.number().int().nonnegative().optional(),
    updates: z.record(z.string(), z.unknown()).optional(),
  })
  // Strict: an envelope that grew unexpected fields is not a delivery we know.
  // It answers 400 instead of being partially trusted.
  .strict()

/** The one-off `GET /webhook?hub.*` subscription handshake. */
export const stravaWebhookHandshakeSchema = z.looseObject({
  'hub.mode': z.string().min(1).max(32),
  'hub.verify_token': z.string().min(1).max(256),
  'hub.challenge': z.string().min(1).max(256),
})
