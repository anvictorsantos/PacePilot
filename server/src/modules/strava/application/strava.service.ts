import axios from 'axios'
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { encryptToken, decryptToken } from '@/modules/shared/infrastructure/utils/tokenCrypto.ts'
import type { AthleteDoc } from '@/modules/athlete/application/session.service.ts'

const STRAVA_API = 'https://www.strava.com/api/v3'
const STRAVA_OAUTH = 'https://www.strava.com/oauth'
const STRAVA_TIMEOUT_MS = 15000 // bound sync latency — Strava hangs must not stall workers

/**
 * Thrown when Strava answers 429. Carries the HTTP status so routes can map it
 * to a response without duck-typing an unknown error.
 */
export class StravaRateLimitError extends Error {
  readonly status = 429
  constructor(retryAfter: unknown) {
    super(`Strava rate limited — retry after ${retryAfter}s`)
    this.name = 'StravaRateLimitError'
  }
}

/** Query params Strava's list endpoints accept. */
export interface StravaListParams {
  after?: number
  before?: number
  page?: number
  perPage?: number
}

export function getAuthorizeUrl(state = '', { mobile = false }: { mobile?: boolean } = {}) {
  const params = new URLSearchParams({
    client_id: env.stravaClientId,
    redirect_uri: env.stravaRedirectUri,
    response_type: 'code',
    scope: 'activity:read,profile:read_all',
    state,
  })
  // mobile endpoint app-switches to installed Strava app (falls back to web
  // login when absent). Same params + https redirect back to us.
  const base = mobile ? `${STRAVA_OAUTH}/mobile/authorize` : `${STRAVA_OAUTH}/authorize`
  return `${base}?${params}`
}

export async function exchangeCode(code: string) {
  const { data } = await axios.post(`${STRAVA_OAUTH}/token`, {
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
    code,
    grant_type: 'authorization_code',
  }, { timeout: STRAVA_TIMEOUT_MS })
  return data // access_token, refresh_token, expires_at, athlete
}

export async function refreshAccessToken(refreshToken: string) {
  const { data } = await axios.post(`${STRAVA_OAUTH}/token`, {
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }, { timeout: STRAVA_TIMEOUT_MS })
  return data
}

export async function ensureFreshToken(athlete: AthleteDoc) {
  // Stored tokens may be encrypted — decrypt only for transport, never persist plaintext.
  if (!athlete.expires_at || athlete.expires_at * 1000 > Date.now() + 60_000) return athlete
  const refreshed = await refreshAccessToken(decryptToken(athlete.refresh_token))
  athlete.access_token = encryptToken(refreshed.access_token)
  athlete.refresh_token = encryptToken(refreshed.refresh_token)
  athlete.expires_at = refreshed.expires_at
  await athlete.save()
  return athlete
}

async function stravaGet(athlete: AthleteDoc, path: string, params: Record<string, unknown> = {}) {
  const fresh = await ensureFreshToken(athlete)
  const token = decryptToken(fresh.access_token)
  try {
    const { data } = await axios.get(`${STRAVA_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      timeout: STRAVA_TIMEOUT_MS,
    })
    return data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      const retryAfter = err.response.headers['retry-after'] || 60
      throw new StravaRateLimitError(retryAfter)
    }
    throw err
  }
}

export async function listActivities(
  athlete: AthleteDoc,
  { after, before, page = 1, perPage = 30 }: StravaListParams = {}
) {
  return stravaGet(athlete, '/athlete/activities', {
    after, before, page, per_page: perPage,
  })
}

export async function getActivity(athlete: AthleteDoc, id: number, includeAllEfforts = true) {
  // ponytail: include_all_efforts brings segment_efforts.achievements (trophies: "2nd fastest time 1:45")
  const params = includeAllEfforts ? { include_all_efforts: true } : {}
  return stravaGet(athlete, `/activities/${id}`, params)
}

export async function getAthleteZones(athlete: AthleteDoc) {
  return stravaGet(athlete, '/athlete/zones')
}

export async function getAthlete(athlete: AthleteDoc) {
  return stravaGet(athlete, '/athlete')
}
