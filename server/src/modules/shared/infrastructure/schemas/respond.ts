import type { ZodError } from 'zod'

/** Shared zod failure shape — { error, details: [{ path, message }] }. (Pass 8) */
export function zodDetails(error: ZodError) {
  return error.issues.map(i => ({ path: i.path, message: i.message }))
}
