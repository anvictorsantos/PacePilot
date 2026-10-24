/**
 * Account use cases. Identity is the Athlete row — the same aggregate the
 * training engine already keys on — so a password signup and a Strava link
 * share one id and every existing route keeps working unchanged.
 */
import mongoose from 'mongoose'

import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import type { ConnectionStatus } from '@/modules/providers/application/connection.service.ts'
import { AppError } from '@/modules/shared/infrastructure/errors/AppError.ts'
import { normaliseEmail, passwordProblem } from '@/modules/auth/domain/password-policy.ts'
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  createEmailToken,
  hashEmailToken,
} from '@/modules/auth/domain/email-token.ts'
import type { EmailLocale } from '@/modules/auth/domain/email-sender.ts'
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '@/modules/auth/application/email.service.ts'
import {
  hashPassword,
  verifyPassword,
  dummyPasswordHash,
} from '@/modules/auth/infrastructure/security/password-hasher.ts'

export interface PublicUser {
  id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  profile: string | null
}

export interface StravaLinkState {
  connected: boolean
  promptSeen: boolean
}

export interface AuthSessionView {
  authenticated: boolean
  user: PublicUser | null
  /** Enabled sources and whether each is linked. The provider-neutral gate. */
  connections: ConnectionStatus[]
  /** Legacy Strava link state, kept for one release. */
  strava: StravaLinkState
  emailVerified: boolean
}

export function databaseReady(): boolean {
  return mongoose.connection.readyState === 1
}

export function requireDatabase(): void {
  if (!databaseReady()) {
    throw new AppError('Database not connected — check MONGODB_URI', {
      status: 503,
      code: 'unavailable',
    })
  }
}

/** The shape the client renders. Never include the hash. */
export function publicUser(athlete: Record<string, unknown> | null | undefined): PublicUser | null {
  if (!athlete?._id) return null
  return {
    id: String(athlete._id),
    email: typeof athlete.email === 'string' ? athlete.email : null,
    firstname: typeof athlete.firstname === 'string' ? athlete.firstname : null,
    lastname: typeof athlete.lastname === 'string' ? athlete.lastname : null,
    profile: typeof athlete.profile === 'string' ? athlete.profile : null,
  }
}

export async function registerAccount(emailInput: string, password: string): Promise<PublicUser> {
  requireDatabase()
  const email = normaliseEmail(emailInput)
  const problem = passwordProblem(password)
  if (problem) throw new AppError(problem, { status: 400, code: 'weak_password' })

  const password_hash = await hashPassword(password)
  try {
    const athlete = await Athlete.create({
      email,
      password_hash,
      // A fresh account has not been asked yet; the connect screen owns the
      // first prompt and records the answer.
    })
    return publicUser(athlete.toObject()) as PublicUser
  } catch (error) {
    // Unique partial index on email — the race-safe signal, not the pre-check.
    if ((error as { code?: number } | null)?.code === 11000) {
      throw new AppError('Email already registered', {
        status: 409,
        code: 'email_taken',
      })
    }
    throw error
  }
}

/**
 * Returns the athlete document (with the hash) on success or null on a bad
 * email/password. The caller answers one uniform 401 either way.
 */
export async function authenticate(
  emailInput: string,
  password: string,
): Promise<Record<string, unknown> | null> {
  requireDatabase()
  const email = normaliseEmail(emailInput)
  const athlete = await Athlete.findOne({ email }).select('+password_hash').lean()
  if (!athlete) {
    // Spend comparable work so response time does not reveal whether the
    // address exists.
    await verifyPassword(password, await dummyPasswordHash())
    return null
  }
  const stored = typeof athlete.password_hash === 'string' ? athlete.password_hash : null
  if (!stored) {
    // Legacy Strava-only account: no password to verify yet.
    await verifyPassword(password, await dummyPasswordHash())
    return null
  }
  if (!(await verifyPassword(password, stored))) return null
  await Athlete.updateOne({ _id: athlete._id }, { $set: { last_login_at: new Date() } })
  return athlete as Record<string, unknown>
}

/** Best-effort revocation; the cookie is cleared by the route either way. */
export async function revokeSessions(athleteId: string | null): Promise<void> {
  if (!athleteId || !databaseReady() || !mongoose.isValidObjectId(athleteId)) return
  await Athlete.findByIdAndUpdate(athleteId, { $inc: { tokenVersion: 1 } })
}

export async function markStravaPromptSeen(athleteId: string | null): Promise<void> {
  if (!athleteId || !databaseReady() || !mongoose.isValidObjectId(athleteId)) return
  await Athlete.updateOne(
    {
      _id: athleteId,
      $or: [{ strava_prompt_seen_at: { $exists: false } }, { strava_prompt_seen_at: null }],
    },
    { $set: { strava_prompt_seen_at: new Date() } },
  )
}

/**
 * Mint a fresh verification token and email it. Silently does nothing for an
 * already-verified or mailless account; delivery is best-effort.
 */
export async function sendVerificationFor(
  athleteId: string | null,
  locale: EmailLocale,
): Promise<void> {
  if (!athleteId || !databaseReady() || !mongoose.isValidObjectId(athleteId)) return
  const athlete = await Athlete.findById(athleteId).select('email email_verified_at').lean()
  if (!athlete?.email || athlete.email_verified_at) return

  const token = createEmailToken(EMAIL_VERIFICATION_TTL_MS)
  await Athlete.updateOne(
    { _id: athleteId },
    {
      $set: {
        email_verification_token_hash: token.hash,
        email_verification_expires_at: token.expiresAt,
      },
    },
  )
  await sendVerificationEmail(athlete.email, token.token, locale)
}

export async function verifyEmail(token: string): Promise<void> {
  requireDatabase()
  const result = await Athlete.updateOne(
    {
      email_verification_token_hash: hashEmailToken(token),
      email_verification_expires_at: { $gt: new Date() },
    },
    {
      $set: { email_verified_at: new Date() },
      $unset: {
        email_verification_token_hash: 1,
        email_verification_expires_at: 1,
      },
    },
  )
  if (!result.modifiedCount) {
    throw new AppError('Invalid or expired verification link', {
      status: 400,
      code: 'invalid_token',
    })
  }
}

/**
 * Always resolves, whatever the address. The route returns the same response
 * for a real and an unknown account so this endpoint cannot enumerate users.
 */
export async function requestPasswordReset(
  emailInput: string,
  locale: EmailLocale,
): Promise<void> {
  requireDatabase()
  const email = normaliseEmail(emailInput)
  const athlete = await Athlete.findOne({ email }).select('+password_hash').lean()
  // Legacy Strava-only rows have no password to reset.
  if (!athlete?.email || !athlete.password_hash) return

  const token = createEmailToken(PASSWORD_RESET_TTL_MS)
  await Athlete.updateOne(
    { _id: athlete._id },
    {
      $set: {
        password_reset_token_hash: token.hash,
        password_reset_expires_at: token.expiresAt,
      },
    },
  )
  await sendPasswordResetEmail(athlete.email, token.token, locale)
}

export async function resetPassword(token: string, password: string): Promise<void> {
  requireDatabase()
  const problem = passwordProblem(password)
  if (problem) throw new AppError(problem, { status: 400, code: 'weak_password' })

  const password_hash = await hashPassword(password)
  const result = await Athlete.updateOne(
    {
      password_reset_token_hash: hashEmailToken(token),
      password_reset_expires_at: { $gt: new Date() },
    },
    {
      $set: { password_hash },
      $unset: {
        password_reset_token_hash: 1,
        password_reset_expires_at: 1,
      },
      // Every existing session dies with the old password.
      $inc: { tokenVersion: 1 },
    },
  )
  if (!result.modifiedCount) {
    throw new AppError('Invalid or expired reset link', {
      status: 400,
      code: 'invalid_token',
    })
  }
}
