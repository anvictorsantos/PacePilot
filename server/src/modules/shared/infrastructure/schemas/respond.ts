import type { ZodError } from 'zod'

import { env } from '@/modules/shared/infrastructure/config/env.ts'

/** Shared zod failure shape: { error, details: [{ path, message }] }. */
export function zodDetails(error: ZodError) {
  return error.issues.map(i => ({ path: i.path, message: i.message }))
}

/**
 * Field-level validation detail is a development aid. In production the shape stays
 * stable but the detail is omitted, so internal schema paths are not disclosed.
 */
export function zodDetailsForClient(error: ZodError) {
  return env.nodeEnv === 'production' ? undefined : zodDetails(error)
}
