import { z } from 'zod'

/**
 * `:provider` on the provider routes — a lowercase id, bounded like a query
 * value. The path is the only input these routes take, so this is the whole
 * boundary for it: a malformed id is a 400, an unknown one a 404.
 */
export const providerParams = z.object({
  provider: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[a-z][a-z0-9_-]*$/, 'provider must be a lowercase id'),
})
