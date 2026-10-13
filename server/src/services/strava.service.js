import axios from 'axios'
import { env } from '../config/env.js'

const STRAVA_API = 'https://www.strava.com/api/v3'
const STRAVA_OAUTH = 'https://www.strava.com/oauth'

export function getAuthorizeUrl(state = '') {
  const params = new URLSearchParams({
    client_id: env.stravaClientId,
    redirect_uri: env.stravaRedirectUri,
    response_type: 'code',
    scope: 'activity:read,profile:read_all',
    state,
  })
  return `${STRAVA_OAUTH}/authorize?${params}`
}

export async function exchangeCode(code) {
  const { data } = await axios.post(`${STRAVA_OAUTH}/token`, {
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
    code,
    grant_type: 'authorization_code',
  })
  return data // access_token, refresh_token, expires_at, athlete
}

export async function refreshAccessToken(refreshToken) {
  const { data } = await axios.post(`${STRAVA_OAUTH}/token`, {
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  return data
}

export async function ensureFreshToken(athlete) {
  if (!athlete.expires_at || athlete.expires_at * 1000 > Date.now() + 60_000) return athlete
  const refreshed = await refreshAccessToken(athlete.refresh_token)
  athlete.access_token = refreshed.access_token
  athlete.refresh_token = refreshed.refresh_token
  athlete.expires_at = refreshed.expires_at
  await athlete.save()
  return athlete
}

async function stravaGet(athlete, path, params = {}) {
  const fresh = await ensureFreshToken(athlete)
  try {
    const { data } = await axios.get(`${STRAVA_API}${path}`, {
      headers: { Authorization: `Bearer ${fresh.access_token}` },
      params,
    })
    return data
  } catch (err) {
    if (err.response?.status === 429) {
      const retryAfter = err.response.headers['retry-after'] || 60
      const e = new Error(`Strava rate limited — retry after ${retryAfter}s`)
      e.status = 429
      throw e
    }
    throw err
  }
}

export async function listActivities(athlete, { after, before, page = 1, perPage = 30 } = {}) {
  return stravaGet(athlete, '/athlete/activities', {
    after, before, page, per_page: perPage,
  })
}

export async function getActivity(athlete, id) {
  return stravaGet(athlete, `/activities/${id}`)
}

export async function getStreams(athlete, id, keys = ['time', 'distance', 'velocity_smooth', 'heartrate', 'cadence', 'altitude']) {
  return stravaGet(athlete, `/activities/${id}/streams`, {
    keys: keys.join(','),
    key_by_type: true,
  })
}

export async function getLaps(athlete, id) {
  return stravaGet(athlete, `/activities/${id}/laps`)
}

export async function getZones(athlete, id) {
  return stravaGet(athlete, `/activities/${id}/zones`)
}

export async function getAthleteZones(athlete) {
  return stravaGet(athlete, '/athlete/zones')
}

export async function getAthleteStats(athlete, stravaAthleteId) {
  return stravaGet(athlete, `/athletes/${stravaAthleteId}/stats`)
}
