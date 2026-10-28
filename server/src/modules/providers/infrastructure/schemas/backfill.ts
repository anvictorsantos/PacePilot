import { z } from 'zod'

/** `POST/GET/DELETE /api/providers/:provider/backfill` — the path is the input. */
export const backfillParams = z.object({
  provider: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[a-z][a-z0-9_-]*$/, 'provider must be a lowercase id'),
})
