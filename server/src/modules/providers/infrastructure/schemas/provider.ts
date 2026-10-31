import { z } from 'zod'

// `:provider` is the whole boundary for these routes: a malformed id is a 400,
// an unknown one a 404.
export const providerParams = z.object({
  provider: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[a-z][a-z0-9_-]*$/, 'provider must be a lowercase id'),
})
