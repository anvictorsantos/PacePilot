import type { CurrentUser } from '@/modules/account/infrastructure/dto/CurrentUser.ts'
import type { ConnectionEntry } from '@/modules/connections/infrastructure/dto/ConnectionStatus.ts'

/** Legacy Strava link state. New code reads `connections`. */
export interface StravaLinkState {
  connected: boolean
  promptSeen: boolean
}

/** `GET /api/auth/session` — never 401; `authenticated:false` is a normal answer. */
export interface AuthSessionResponse {
  authenticated: boolean
  user: CurrentUser | null
  connections?: ConnectionEntry[]
  /** Legacy project of the Strava connection, kept for one release. */
  strava: StravaLinkState
  /** Optional so older fixtures/tests do not have to restate it. */
  emailVerified?: boolean
}
