/** Shared zod failure shape — { error, details: [{ path, message }] }. (Pass 8) */
export function zodDetails(error) {
  return error.issues.map(i => ({ path: i.path, message: i.message }))
}
