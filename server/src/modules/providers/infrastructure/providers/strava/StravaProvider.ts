/**
 * Strava adapter — the only file that knows Strava's endpoints, auth flow and
 * payload quirks. Everything above it sees `ActivityProvider` and canonical
 * shapes.
 */
import axios from 'axios'

import type {
  ActivityProvider,
  ActivityQuery,
  ProviderTokens,
} from '@/modules/providers/domain/ports/ActivityProvider.ts'
import type {
  CanonicalActivity,
  CanonicalActivityPage,
  CanonicalAthlete,
  CanonicalStreams,
  CanonicalZones,
} from '@/modules/providers/domain/CanonicalActivity.ts'
import type { ProviderCapabilities } from '@/modules/providers/domain/ProviderCapabilities.ts'
import { Provider } from '@/modules/providers/domain/Provider.ts'
import {
  ProviderAuthError,
  ProviderError,
  ProviderRateLimitError,
} from '@/modules/providers/domain/errors.ts'
import {
  mapActivity,
  mapStreams,
  type StravaActivityPayload,
} from '@/modules/providers/infrastructure/providers/strava/mapping.ts'

const STRAVA_API = 'https://www.strava.com/api/v3'
const STRAVA_OAUTH = 'https://www.strava.com/oauth'
const TIMEOUT_MS = 15000

export interface StravaConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface StravaTokensResponse {
  access_token: string
  refresh_token?: string
  expires_at?: number
  scope?: string
  athlete?: {
    id: number
    firstname?: string
    lastname?: string
    profile?: string
    badge_type_id?: number
    badges?: unknown
  }
}

const CAPABILITIES: ProviderCapabilities = {
  pull: true,
  webhook: false,
  streams: true,
  laps: true,
  segments: true,
  zones: true,
  profile: true,
}

function toProviderError(error: unknown, provider = Provider.Strava): never {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      throw new ProviderRateLimitError(provider, error.response.headers['retry-after'] ?? 60)
    }
    if (error.response?.status === 401) {
      throw new ProviderAuthError(provider, `${provider} credentials rejected`)
    }
    throw new ProviderError(`${provider} request failed`, {
      status: error.response?.status && error.response.status >= 500 ? 502 : 400,
      provider,
      code: 'upstream_error',
    })
  }
  if (error instanceof ProviderError) throw error
  throw new ProviderError(`${provider} request failed`, { provider, code: 'network' })
}

function tokensFrom(data: StravaTokensResponse): ProviderTokens {
  const athlete = data.athlete
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
    scopes: data.scope ? data.scope.split(/[ ,]+/).filter(Boolean) : [],
    externalAthleteId: athlete?.id != null ? String(athlete.id) : null,
    profile: athlete
      ? {
          externalAthleteId: String(athlete.id),
          firstname: athlete.firstname ?? null,
          lastname: athlete.lastname ?? null,
          profile: athlete.profile ?? null,
          badges: athlete.badges,
          badgeTypeId: athlete.badge_type_id ?? null,
        }
      : null,
  }
}

/** `/athlete/zones` arrives as `{heart_rate:{zones}}` or an array of groups. */
export function mapZones(raw: unknown): CanonicalZones | null {
  if (!raw || typeof raw !== 'object') return null
  const groups = Array.isArray(raw) ? raw : null
  const heartRate =
    (raw as { heart_rate?: { zones?: unknown } }).heart_rate?.zones ??
    groups?.find((group) => (group as { type?: unknown }).type === 'heartrate')?.zones ??
    (Array.isArray((raw as { zones?: unknown }).zones) ? (raw as { zones?: unknown }).zones : null)
  if (!Array.isArray(heartRate)) return null
  const zones: CanonicalZones = []
  for (const zone of heartRate) {
    const entry = zone as { min?: unknown; max?: unknown }
    const min = Number(entry.min)
    const max = Number(entry.max)
    if (Number.isFinite(min) && Number.isFinite(max)) zones.push({ min, max })
  }
  return zones.length ? zones : null
}

export function createStravaProvider(config: StravaConfig): ActivityProvider {
  async function get(path: string, accessToken: string, params: Record<string, unknown> = {}) {
    try {
      const { data } = await axios.get(`${STRAVA_API}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
        timeout: TIMEOUT_MS,
      })
      return data
    } catch (error) {
      return toProviderError(error)
    }
  }

  return {
    id: Provider.Strava,
    capabilities: CAPABILITIES,

    authorizeUrl(state, { mobile = false } = {}) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'activity:read,profile:read_all',
        state,
      })
      // The mobile endpoint app-switches to the installed app; desktop uses web.
      const base = mobile ? `${STRAVA_OAUTH}/mobile/authorize` : `${STRAVA_OAUTH}/authorize`
      return `${base}?${params}`
    },

    async exchangeCode(code) {
      try {
        const { data } = await axios.post(
          `${STRAVA_OAUTH}/token`,
          {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            grant_type: 'authorization_code',
          },
          { timeout: TIMEOUT_MS },
        )
        return tokensFrom(data as StravaTokensResponse)
      } catch (error) {
        return toProviderError(error)
      }
    },

    async refresh(refreshToken) {
      try {
        const { data } = await axios.post(
          `${STRAVA_OAUTH}/token`,
          {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          },
          { timeout: TIMEOUT_MS },
        )
        return tokensFrom(data as StravaTokensResponse)
      } catch (error) {
        return toProviderError(error)
      }
    },

    async revoke(accessToken) {
      try {
        await axios.post(
          `${STRAVA_OAUTH}/deauthorize`,
          null,
          { params: { access_token: accessToken }, timeout: TIMEOUT_MS },
        )
      } catch (error) {
        return toProviderError(error)
      }
    },

    async listActivities(accessToken, query: ActivityQuery = {}): Promise<CanonicalActivityPage> {
      const perPage = query.perPage ?? 30
      const data = (await get('/athlete/activities', accessToken, {
        after: query.after ? Math.floor(query.after.getTime() / 1000) : undefined,
        before: query.before ? Math.floor(query.before.getTime() / 1000) : undefined,
        page: query.page ?? 1,
        per_page: perPage,
      })) as StravaActivityPayload[]
      if (!Array.isArray(data)) {
        throw new ProviderError('Strava returned a non-list activity page', {
          provider: Provider.Strava,
          code: 'bad_response',
        })
      }
      return {
        items: data.map(mapActivity),
        hasMore: data.length >= perPage,
      }
    },

    async getActivity(accessToken, externalId): Promise<CanonicalActivity | null> {
      try {
        const data = (await get(`/activities/${encodeURIComponent(externalId)}`, accessToken, {
          // `include_all_efforts` brings segment achievements (trophies).
          include_all_efforts: true,
        })) as StravaActivityPayload
        return data ? mapActivity(data) : null
      } catch (error) {
        if (error instanceof ProviderError && error.status === 400) return null
        throw error
      }
    },

    async getStreams(accessToken, externalId): Promise<CanonicalStreams | null> {
      try {
        const data = await get(`/activities/${encodeURIComponent(externalId)}/streams`, accessToken, {
          keys: 'time,distance,velocity_smooth,heartrate,latlng',
          key_by_type: true,
        })
        return mapStreams(data).streams
      } catch (error) {
        // Manual/older activities answer 404 here: "no streams", not a failure.
        if (error instanceof ProviderError && (error.status === 404 || error.status === 400)) return null
        throw error
      }
    },

    async getZones(accessToken): Promise<CanonicalZones | null> {
      return mapZones(await get('/athlete/zones', accessToken))
    },

    async getProfile(accessToken): Promise<CanonicalAthlete | null> {
      const data = (await get('/athlete', accessToken)) as {
        id?: number
        firstname?: string
        lastname?: string
        profile?: string
        badges?: unknown
        badge_type_id?: number
      }
      if (!data?.id) return null
      return {
        externalAthleteId: String(data.id),
        firstname: data.firstname ?? null,
        lastname: data.lastname ?? null,
        profile: data.profile ?? null,
        badges: data.badges,
        badgeTypeId: data.badge_type_id ?? null,
      }
    },
  }
}

/** Exposed for diagnostics/tests: the provider's own 429 hint. */
export function retryAfterFrom(error: unknown): number {
  return error instanceof ProviderRateLimitError ? error.retryAfter : 60
}
