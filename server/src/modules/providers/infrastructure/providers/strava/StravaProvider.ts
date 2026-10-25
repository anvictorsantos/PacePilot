/**
 * Strava adapter — the only file that knows Strava's endpoints, auth flow and
 * payload quirks. Everything above it sees `ActivityProvider` and canonical
 * shapes.
 */
import axios from 'axios'
import crypto from 'node:crypto'

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
import type {
  CanonicalWebhookEvent,
  WebhookAuthorisation,
  WebhookHandshake,
} from '@/modules/providers/domain/Webhook.ts'
import {
  stravaWebhookEventSchema,
  stravaWebhookHandshakeSchema,
} from '@/modules/providers/infrastructure/schemas/webhook.ts'
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
  /**
   * The value Strava echoes during the subscription handshake. Empty means the
   * deployment has no push subscription yet, and the endpoint says so.
   */
  webhookVerifyToken?: string
  /** Returned once when the subscription is created; ties deliveries to us. */
  webhookSubscriptionId?: string
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
  // Push tells us an activity changed; the pull window stays as the fallback.
  webhook: true,
  streams: true,
  laps: true,
  segments: true,
  zones: true,
  profile: true,
}

function toProviderError(error: unknown, provider = Provider.Strava): never {
  if (axios.isAxiosError(error)) {
    const upstream = error.response?.status ?? null
    if (upstream === 429) {
      throw new ProviderRateLimitError(provider, error.response?.headers['retry-after'] ?? 60)
    }
    if (upstream === 401) {
      throw new ProviderAuthError(provider, `${provider} credentials rejected`)
    }
    // The upstream status rides along so a caller can tell "gone" (404) from
    // "forbidden" (403) without re-reading the provider's body.
    throw new ProviderError(`${provider} request failed`, {
      status: upstream && upstream >= 500 ? 502 : 400,
      provider,
      code: 'upstream_error',
      upstreamStatus: upstream,
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

/**
 * Compare two configured values in constant time. Length is allowed to leak:
 * it is not the secret, and `timingSafeEqual` throws on a mismatch.
 */
function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function webhookObjectType(value: string): CanonicalWebhookEvent['objectType'] {
  if (value === 'activity' || value === 'athlete') return value
  return 'other'
}

function webhookAspect(value: string): CanonicalWebhookEvent['aspect'] {
  if (value === 'create' || value === 'update' || value === 'delete') return value
  return 'other'
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
        // POST /oauth/revoke (recommended since 1 Jun 2026, the only endpoint
        // supported from 1 Jun 2027). HTTP Basic client_id:client_secret, form
        // body with the token; `deauthorize` is the legacy path.
        await axios.post(
          `${STRAVA_OAUTH}/revoke`,
          new URLSearchParams({ token: accessToken, token_type_hint: 'access_token' }).toString(),
          {
            auth: { username: config.clientId, password: config.clientSecret },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: TIMEOUT_MS,
          },
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
        // Only a real 404 means the activity is gone. A 403 is a permission
        // problem and must surface as one, not as "this activity never existed".
        if (error instanceof ProviderError && error.upstreamStatus === 404) return null
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

    /**
     * Strava calls this once when the subscription is created. With no verify
     * token configured there is nothing to compare against, so the deployment
     * is reported as unconfigured rather than accepting the caller.
     */
    verifyWebhook(query): WebhookHandshake {
      if (!config.webhookVerifyToken) return { status: 'unconfigured' }

      const parsed = stravaWebhookHandshakeSchema.safeParse(query)
      if (!parsed.success) return { status: 'rejected' }
      if (parsed.data['hub.mode'] !== 'subscribe') return { status: 'rejected' }
      if (!safeEqual(parsed.data['hub.verify_token'], config.webhookVerifyToken)) {
        return { status: 'rejected' }
      }
      return { status: 'verified', challenge: parsed.data['hub.challenge'] }
    },

    /**
     * The delivery names an activity; it does not carry one. Everything the
     * canonical writer needs is fetched afterwards through `getActivity`.
     */
    parseWebhook(body): CanonicalWebhookEvent | null {
      const parsed = stravaWebhookEventSchema.safeParse(body)
      if (!parsed.success) return null
      const data = parsed.data
      const isActivity = data.object_type === 'activity'
      return {
        provider: Provider.Strava,
        objectType: webhookObjectType(data.object_type),
        externalActivityId: isActivity ? String(data.object_id) : null,
        externalAthleteId: String(data.owner_id),
        aspect: webhookAspect(data.aspect_type),
        subscriptionId: data.subscription_id != null ? String(data.subscription_id) : null,
        eventTime: data.event_time != null ? new Date(data.event_time * 1000) : null,
      }
    },

    /**
     * Strava sends no per-delivery signature. The subscription id returned by
     * the verified handshake is the only signal that a delivery is ours, so a
     * missing or foreign id is refused.
     */
    authoriseWebhook(event): WebhookAuthorisation {
      if (!config.webhookSubscriptionId) return 'unconfigured'
      if (!event.subscriptionId) return 'rejected'
      return safeEqual(event.subscriptionId, config.webhookSubscriptionId)
        ? 'authorised'
        : 'rejected'
    },
  }
}

/** Exposed for diagnostics/tests: the provider's own 429 hint. */
export function retryAfterFrom(error: unknown): number {
  return error instanceof ProviderRateLimitError ? error.retryAfter : 60
}
