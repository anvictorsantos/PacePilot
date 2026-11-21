import { z } from 'zod'

// Strava's push envelope names an activity but carries no activity data, so the push
// path still reads the canonical record from the provider.
const externalId = z
  .union([z.number().int().nonnegative(), z.string().min(1).max(64)])
  // A JSON number past 2^53 already lost digits before validation: refuse it
  // rather than resolve the wrong activity.
  .refine((value) => typeof value !== 'number' || Number.isSafeInteger(value))

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
  // Strict: an envelope that grew unexpected fields answers 400, not partial trust.
  .strict()

export const stravaWebhookHandshakeSchema = z.looseObject({
  'hub.mode': z.string().min(1).max(32),
  'hub.verify_token': z.string().min(1).max(256),
  'hub.challenge': z.string().min(1).max(256),
})
