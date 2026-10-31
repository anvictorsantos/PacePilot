// Pure and framework-free, so the same limits are testable without Express or Mongo.

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 254

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Normalise an address for lookup and storage. Never reject here. */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= EMAIL_MAX_LENGTH &&
    EMAIL_SHAPE.test(value) &&
    !value.includes('\u0000')
  )
}

export function passwordProblem(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
  }
  if (value.includes('\u0000')) return 'Password contains an invalid character'
  return null
}

export function isValidPassword(value: string): boolean {
  return passwordProblem(value) === null
}
