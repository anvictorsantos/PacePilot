import type { CurrentUser } from '@/modules/account/infrastructure/dto/CurrentUser.ts'

/** Strava is a link on the account, not the identity provider. */
export interface StravaLinkState {
  connected: boolean
  promptSeen: boolean
}

/** `GET /api/auth/session` — never 401; `authenticated:false` is a normal answer. */
export interface AuthSessionResponse {
  authenticated: boolean
  user: CurrentUser | null
  strava: StravaLinkState
  /** Optional so older fixtures/tests do not have to restate it. */
  emailVerified?: boolean
}
