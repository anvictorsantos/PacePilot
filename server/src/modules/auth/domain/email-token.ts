// The raw value only ever exists in the link and in transit; the database stores
// a SHA-256 digest, so a database read cannot mint a working link.
import { createHash, randomBytes } from 'node:crypto'

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000

export interface EmailToken {
  /** Goes in the URL. Never store this. */
  token: string
  /** Goes in Mongo. */
  hash: string
  expiresAt: Date
}

export function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createEmailToken(ttlMs: number, now = Date.now()): EmailToken {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    hash: hashEmailToken(token),
    expiresAt: new Date(now + ttlMs),
  }
}
