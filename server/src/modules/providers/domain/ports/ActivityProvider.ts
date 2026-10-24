import type {
  CanonicalActivity,
  CanonicalActivityPage,
  CanonicalAthlete,
  CanonicalStreams,
  CanonicalZones,
} from '@/modules/providers/domain/CanonicalActivity.ts'
import type { ProviderCapabilities } from '@/modules/providers/domain/ProviderCapabilities.ts'

/** Query in domain terms: Dates, page and size. Adapters convert to wire params. */
export interface ActivityQuery {
  after?: Date
  before?: Date
  page?: number
  perPage?: number
}

export interface ProviderTokens {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
  scopes?: string[]
  externalAthleteId?: string | null
  profile?: CanonicalAthlete | null
}

/**
 * The one port a provider implements. The application loads a connection,
 * ensures a fresh token, and calls these methods; it never sees axios, an
 * OAuth endpoint or a provider field name.
 */
export interface ActivityProvider {
  readonly id: string
  readonly capabilities: ProviderCapabilities

  authorizeUrl(state: string, options?: { mobile?: boolean }): string
  exchangeCode(code: string): Promise<ProviderTokens>
  refresh(refreshToken: string): Promise<ProviderTokens>
  revoke(accessToken: string): Promise<void>

  listActivities(accessToken: string, query?: ActivityQuery): Promise<CanonicalActivityPage>
  getActivity(accessToken: string, externalId: string): Promise<CanonicalActivity | null>
  getStreams?(accessToken: string, externalId: string): Promise<CanonicalStreams | null>
  getZones?(accessToken: string): Promise<CanonicalZones | null>
  getProfile?(accessToken: string): Promise<CanonicalAthlete | null>
}
