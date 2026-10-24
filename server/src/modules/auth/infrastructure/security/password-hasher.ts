/**
 * Password hashing — Node's built-in scrypt, no new dependency.
 *
 * The stored format keeps the parameters with the digest so a future cost bump
 * can rehash on a successful login instead of invalidating every password:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64>$<key base64>
 *
 * scrypt is intentionally CPU-heavy; every call is async so the event loop is
 * not blocked by a login.
 */
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64
const SALT_BYTES = 16
const PREFIX = 'scrypt'

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error)
      else resolve(derived)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P })
  return [PREFIX, N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

/**
 * Verify without leaking which part failed. Malformed stored values return
 * false rather than throwing, so a legacy or corrupted row is a normal 401.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== PREFIX) return false

  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  if (n < 1024 || r < 1 || p < 1) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(parts[4], 'base64')
    expected = Buffer.from(parts[5], 'base64')
  } catch {
    return false
  }
  if (!salt.length || !expected.length) return false

  const actual = await derive(password, salt, expected.length, { N: n, r, p })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * A fixed hash used to spend the same work on an unknown email as on a real
 * one. Built lazily so module import stays cheap.
 */
let dummyHash: Promise<string> | null = null

export function dummyPasswordHash(): Promise<string> {
  if (!dummyHash) dummyHash = hashPassword('not-a-real-password-0000')
  return dummyHash
}
